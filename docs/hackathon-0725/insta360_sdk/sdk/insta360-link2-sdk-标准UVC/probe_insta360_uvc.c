#include <libusb-1.0/libusb.h>
#include <stdio.h>

static void dump_hex(const unsigned char *p, int n) {
  for (int i = 0; i < n; i++) printf("%02x%s", p[i], (i + 1) % 16 ? " " : "\n");
  if (n % 16) printf("\n");
}

int main(void) {
  libusb_context *ctx = NULL;
  libusb_device **list = NULL;
  ssize_t count;

  if (libusb_init(&ctx) != 0) return 1;
  count = libusb_get_device_list(ctx, &list);
  if (count < 0) return 2;

  for (ssize_t i = 0; i < count; i++) {
    struct libusb_device_descriptor dd;
    libusb_device *dev = list[i];
    if (libusb_get_device_descriptor(dev, &dd) != 0) continue;
    if (dd.idVendor != 0x2e1a || dd.idProduct != 0x4c04) continue;

    printf("Found Insta360 Link 2: vid=%04x pid=%04x bcdDevice=%04x configs=%u\n",
           dd.idVendor, dd.idProduct, dd.bcdDevice, dd.bNumConfigurations);

    for (int c = 0; c < dd.bNumConfigurations; c++) {
      struct libusb_config_descriptor *cfg = NULL;
      if (libusb_get_config_descriptor(dev, c, &cfg) != 0) continue;
      printf("Config %d: interfaces=%u extra_len=%d\n", c, cfg->bNumInterfaces, cfg->extra_length);
      if (cfg->extra_length) dump_hex(cfg->extra, cfg->extra_length);

      for (int ifn = 0; ifn < cfg->bNumInterfaces; ifn++) {
        const struct libusb_interface *iface = &cfg->interface[ifn];
        for (int alt = 0; alt < iface->num_altsetting; alt++) {
          const struct libusb_interface_descriptor *id = &iface->altsetting[alt];
          printf("Interface %d alt %d class=%u subclass=%u proto=%u eps=%u extra_len=%d\n",
                 id->bInterfaceNumber, id->bAlternateSetting, id->bInterfaceClass,
                 id->bInterfaceSubClass, id->bInterfaceProtocol, id->bNumEndpoints,
                 id->extra_length);
          if (id->extra_length) dump_hex(id->extra, id->extra_length);
        }
      }
      libusb_free_config_descriptor(cfg);
    }
  }

  libusb_free_device_list(list, 1);
  libusb_exit(ctx);
  return 0;
}
