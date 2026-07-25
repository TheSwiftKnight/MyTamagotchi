#include <libusb-1.0/libusb.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define VID 0x2e1a
#define PID 0x4c04
#define IFACE 0
#define ENTITY_CAMERA_TERMINAL 1
#define UVC_SET_CUR 0x01
#define UVC_GET_CUR 0x81
#define CT_PANTILT_ABS 0x0d

static int ctrl(libusb_device_handle *h, unsigned char req, unsigned char selector,
                unsigned char *data, unsigned short len) {
  unsigned char bm = (req & 0x80) ? 0xa1 : 0x21;
  unsigned short wValue = ((unsigned short)selector) << 8;
  unsigned short wIndex = (((unsigned short)ENTITY_CAMERA_TERMINAL) << 8) | IFACE;
  return libusb_control_transfer(h, bm, req, wValue, wIndex, data, len, 1000);
}

static void put_i32le(unsigned char *p, int32_t v) {
  p[0] = (unsigned char)(v & 0xff);
  p[1] = (unsigned char)((v >> 8) & 0xff);
  p[2] = (unsigned char)((v >> 16) & 0xff);
  p[3] = (unsigned char)((v >> 24) & 0xff);
}

static int32_t get_i32le(const unsigned char *p) {
  return (int32_t)((uint32_t)p[0] | ((uint32_t)p[1] << 8) |
                   ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24));
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "usage: %s <pan> <tilt>\n", argv[0]);
    return 2;
  }

  int32_t pan = (int32_t)strtol(argv[1], NULL, 10);
  int32_t tilt = (int32_t)strtol(argv[2], NULL, 10);
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
  if (rc == 8) printf("before pan=%d tilt=%d\n", get_i32le(cur), get_i32le(cur + 4));
  else printf("before read rc=%d\n", rc);

  unsigned char out[8] = {0};
  put_i32le(out, pan);
  put_i32le(out + 4, tilt);
  rc = ctrl(h, UVC_SET_CUR, CT_PANTILT_ABS, out, sizeof(out));
  printf("set pan=%d tilt=%d rc=%d\n", pan, tilt, rc);

  memset(cur, 0, sizeof(cur));
  rc = ctrl(h, UVC_GET_CUR, CT_PANTILT_ABS, cur, sizeof(cur));
  if (rc == 8) printf("after pan=%d tilt=%d\n", get_i32le(cur), get_i32le(cur + 4));
  else printf("after read rc=%d\n", rc);

  libusb_close(h);
  libusb_exit(ctx);
  return 0;
}
