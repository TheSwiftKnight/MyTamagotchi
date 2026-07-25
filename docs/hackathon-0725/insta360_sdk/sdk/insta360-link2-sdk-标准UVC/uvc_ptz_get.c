#include <libusb-1.0/libusb.h>
#include <stdint.h>
#include <stdio.h>

#define VID 0x2e1a
#define PID 0x4c04
#define IFACE 0
#define ENTITY_CAMERA_TERMINAL 1
#define UVC_GET_CUR 0x81
#define CT_PANTILT_ABS 0x0d

static int ctrl(libusb_device_handle *h, unsigned char req, unsigned char selector,
                unsigned char *data, unsigned short len) {
  unsigned char bm = (req & 0x80) ? 0xa1 : 0x21;
  unsigned short wValue = ((unsigned short)selector) << 8;
  unsigned short wIndex = (((unsigned short)ENTITY_CAMERA_TERMINAL) << 8) | IFACE;
  return libusb_control_transfer(h, bm, req, wValue, wIndex, data, len, 1000);
}

static int32_t get_i32le(const unsigned char *p) {
  return (int32_t)((uint32_t)p[0] | ((uint32_t)p[1] << 8) |
                   ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24));
}

int main(void) {
  libusb_context *ctx = NULL;
  libusb_init(&ctx);
  libusb_device_handle *h = libusb_open_device_with_vid_pid(ctx, VID, PID);
  if (!h) {
    fprintf(stderr, "open failed\n");
    libusb_exit(ctx);
    return 1;
  }

  unsigned char cur[8] = {0};
  int rc = ctrl(h, UVC_GET_CUR, CT_PANTILT_ABS, cur, sizeof(cur));
  if (rc != 8) {
    fprintf(stderr, "read failed rc=%d\n", rc);
    libusb_close(h);
    libusb_exit(ctx);
    return 1;
  }

  printf("{\"pan\":%d,\"tilt\":%d}\n", get_i32le(cur), get_i32le(cur + 4));
  libusb_close(h);
  libusb_exit(ctx);
  return 0;
}
