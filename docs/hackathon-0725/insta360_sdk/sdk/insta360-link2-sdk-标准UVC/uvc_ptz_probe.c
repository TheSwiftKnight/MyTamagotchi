#include <libusb-1.0/libusb.h>
#include <stdio.h>
#include <string.h>

#define VID 0x2e1a
#define PID 0x4c04
#define IFACE 0
#define ENTITY_CAMERA_TERMINAL 1

static int xfer(libusb_device_handle *h, unsigned char req, unsigned char selector,
                unsigned char *data, unsigned short len) {
  unsigned char bm = (req & 0x80) ? 0xa1 : 0x21;
  unsigned short wValue = ((unsigned short)selector) << 8;
  unsigned short wIndex = (((unsigned short)ENTITY_CAMERA_TERMINAL) << 8) | IFACE;
  return libusb_control_transfer(h, bm, req, wValue, wIndex, data, len, 1000);
}

static void dump(const char *label, unsigned char req, unsigned char sel, int len) {
  libusb_device_handle *h = libusb_open_device_with_vid_pid(NULL, VID, PID);
  if (!h) {
    printf("open failed\n");
    return;
  }
  unsigned char buf[64];
  memset(buf, 0, sizeof(buf));
  int rc = xfer(h, req, sel, buf, len);
  printf("%s sel=0x%02x req=0x%02x rc=%d", label, sel, req, rc);
  if (rc > 0) {
    printf(" data=");
    for (int i = 0; i < rc; i++) printf("%02x%s", buf[i], i + 1 == rc ? "" : " ");
  }
  printf("\n");
  libusb_close(h);
}

int main(void) {
  libusb_context *ctx = NULL;
  libusb_init(&ctx);
  unsigned char sels[] = {0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f};
  const char *names[] = {"zoom_abs", "zoom_rel", "pantilt_abs", "pantilt_rel", "roll_abs", "roll_rel"};
  for (int i = 0; i < 6; i++) {
    printf("-- %s --\n", names[i]);
    dump("INFO", 0x86, sels[i], 1);
    dump("LEN ", 0x85, sels[i], 2);
    dump("MIN ", 0x82, sels[i], 16);
    dump("MAX ", 0x83, sels[i], 16);
    dump("RES ", 0x84, sels[i], 16);
    dump("DEF ", 0x87, sels[i], 16);
    dump("CUR ", 0x81, sels[i], 16);
  }
  libusb_exit(ctx);
  return 0;
}
