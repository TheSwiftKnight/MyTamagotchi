// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @title Agent Land Skill Market
/// @notice Publishes ERC-8004-owned skills and settles License / per-call payments in native INJ.
/// @dev Skill packages remain off-chain. Only public metadata, content commitments, payments,
///      licenses, usage receipts, and revenue balances are stored on-chain.
contract AgentSkillMarket {
    enum PricingMode {
        License,
        PerCall
    }

    struct Listing {
        uint256 publisherAgentId;
        address publisher;
        address collaborator;
        bytes32 skillKey;
        bytes32 manifestRoot;
        uint128 priceWei;
        PricingMode pricingMode;
        bool active;
        uint64 createdAt;
        string name;
        string summary;
        string metadataURI;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant PLATFORM_BPS = 500;
    uint256 public constant COLLABORATOR_BPS = 500;

    IAgentIdentityRegistry public immutable identityRegistry;
    address public immutable platformTreasury;

    uint256 public listingCount;
    mapping(uint256 listingId => Listing listing) private listings;
    mapping(uint256 listingId => mapping(address buyer => bool licensed)) public hasLicense;
    mapping(uint256 listingId => uint256 calls) public callCount;
    mapping(address recipient => uint256 amount) public pendingRevenue;

    uint256 private withdrawalLock = 1;

    error EmptyField();
    error InactiveListing();
    error InvalidAddress();
    error InvalidManifest();
    error InvalidMode();
    error InvalidPayment();
    error InvalidPrice();
    error LicenseAlreadyOwned();
    error NotAgentOwner();
    error NotPublisher();
    error NothingToWithdraw();
    error TextTooLong();
    error TransferFailed();

    event SkillPublished(
        uint256 indexed listingId,
        uint256 indexed publisherAgentId,
        address indexed publisher,
        bytes32 skillKey,
        bytes32 manifestRoot,
        uint128 priceWei,
        PricingMode pricingMode,
        address collaborator,
        string name,
        string metadataURI
    );
    event ListingStatusChanged(uint256 indexed listingId, bool active);
    event LicensePurchased(
        uint256 indexed listingId,
        uint256 indexed buyerAgentId,
        address indexed buyer,
        uint256 amount,
        bytes32 manifestRoot
    );
    event SkillCalled(
        uint256 indexed listingId,
        uint256 indexed buyerAgentId,
        address indexed buyer,
        bytes32 requestHash,
        uint256 amount,
        uint256 callNumber
    );
    event RevenueAccrued(
        uint256 indexed listingId,
        address indexed publisher,
        address indexed collaborator,
        uint256 publisherAmount,
        uint256 collaboratorAmount,
        uint256 platformAmount
    );
    event RevenueWithdrawn(address indexed recipient, uint256 amount);

    constructor(address identityRegistry_, address platformTreasury_) {
        if (identityRegistry_ == address(0) || platformTreasury_ == address(0)) {
            revert InvalidAddress();
        }
        identityRegistry = IAgentIdentityRegistry(identityRegistry_);
        platformTreasury = platformTreasury_;
    }

    function publishSkill(
        uint256 publisherAgentId,
        bytes32 skillKey,
        string calldata name,
        string calldata summary,
        string calldata metadataURI,
        bytes32 manifestRoot,
        uint128 priceWei,
        PricingMode pricingMode,
        address collaborator
    ) external returns (uint256 listingId) {
        if (identityRegistry.ownerOf(publisherAgentId) != msg.sender) revert NotAgentOwner();
        if (skillKey == bytes32(0) || bytes(name).length == 0 || bytes(metadataURI).length == 0) {
            revert EmptyField();
        }
        if (bytes(name).length > 96 || bytes(summary).length > 384 || bytes(metadataURI).length > 512) {
            revert TextTooLong();
        }
        if (manifestRoot == bytes32(0)) revert InvalidManifest();
        if (priceWei == 0) revert InvalidPrice();
        if (uint8(pricingMode) > uint8(PricingMode.PerCall)) revert InvalidMode();

        listingId = ++listingCount;
        listings[listingId] = Listing({
            publisherAgentId: publisherAgentId,
            publisher: msg.sender,
            collaborator: collaborator,
            skillKey: skillKey,
            manifestRoot: manifestRoot,
            priceWei: priceWei,
            pricingMode: pricingMode,
            active: true,
            createdAt: uint64(block.timestamp),
            name: name,
            summary: summary,
            metadataURI: metadataURI
        });

        emit SkillPublished(
            listingId,
            publisherAgentId,
            msg.sender,
            skillKey,
            manifestRoot,
            priceWei,
            pricingMode,
            collaborator,
            name,
            metadataURI
        );
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function setListingActive(uint256 listingId, bool active) external {
        Listing storage listing = listings[listingId];
        if (listing.publisher != msg.sender) revert NotPublisher();
        listing.active = active;
        emit ListingStatusChanged(listingId, active);
    }

    function purchaseLicense(uint256 listingId, uint256 buyerAgentId) external payable {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert InactiveListing();
        if (listing.pricingMode != PricingMode.License) revert InvalidMode();
        if (msg.value != listing.priceWei) revert InvalidPayment();
        if (buyerAgentId != 0 && identityRegistry.ownerOf(buyerAgentId) != msg.sender) {
            revert NotAgentOwner();
        }
        if (hasLicense[listingId][msg.sender]) revert LicenseAlreadyOwned();

        hasLicense[listingId][msg.sender] = true;
        _accrueRevenue(listingId, listing, msg.value);
        emit LicensePurchased(listingId, buyerAgentId, msg.sender, msg.value, listing.manifestRoot);
    }

    function callSkill(uint256 listingId, uint256 buyerAgentId, bytes32 requestHash) external payable {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert InactiveListing();
        if (listing.pricingMode != PricingMode.PerCall) revert InvalidMode();
        if (msg.value != listing.priceWei) revert InvalidPayment();
        if (requestHash == bytes32(0)) revert InvalidManifest();
        if (buyerAgentId != 0 && identityRegistry.ownerOf(buyerAgentId) != msg.sender) {
            revert NotAgentOwner();
        }

        uint256 callNumber = ++callCount[listingId];
        _accrueRevenue(listingId, listing, msg.value);
        emit SkillCalled(listingId, buyerAgentId, msg.sender, requestHash, msg.value, callNumber);
    }

    function withdrawRevenue() external {
        if (withdrawalLock != 1) revert TransferFailed();
        uint256 amount = pendingRevenue[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        withdrawalLock = 2;
        pendingRevenue[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        withdrawalLock = 1;
        if (!success) revert TransferFailed();

        emit RevenueWithdrawn(msg.sender, amount);
    }

    function _accrueRevenue(uint256 listingId, Listing storage listing, uint256 amount) private {
        uint256 platformAmount = amount * PLATFORM_BPS / BPS;
        uint256 collaboratorAmount;
        if (listing.collaborator != address(0)) {
            collaboratorAmount = amount * COLLABORATOR_BPS / BPS;
            pendingRevenue[listing.collaborator] += collaboratorAmount;
        }
        uint256 publisherAmount = amount - platformAmount - collaboratorAmount;

        pendingRevenue[listing.publisher] += publisherAmount;
        pendingRevenue[platformTreasury] += platformAmount;
        emit RevenueAccrued(
            listingId,
            listing.publisher,
            listing.collaborator,
            publisherAmount,
            collaboratorAmount,
            platformAmount
        );
    }
}
