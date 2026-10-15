include $(sort $(wildcard $(BR2_EXTERNAL_ELITEEW_TS_PATH)/package/*/*.mk))

# Stock Buildroot webkitgtk.mk hardcodes -DENABLE_WEB_RTC=OFF. CMake last -D wins.
# Resume builds skip tree patches; this keeps Meet RTCPeerConnection on.
# Pin is 2.52.6 (patch 0005). 2.54.0 disables WebRTC until LibWebRTC in 2.56.
# 2.52 WebRTC can require librice; we stay on libnice (not in this BR).
# 2.52 defaults ENABLE_SPEECH_SYNTHESIS+USE_FLITE; no Flite on this floor.
ifeq ($(BR2_PACKAGE_WEBKITGTK)$(BR2_PACKAGE_WEBKITGTK_MULTIMEDIA),yy)
WEBKITGTK_CONF_OPTS += -DENABLE_WEB_RTC=ON
WEBKITGTK_CONF_OPTS += -DENABLE_MEDIA_STREAM=ON
WEBKITGTK_CONF_OPTS += -DUSE_LIBRICE=OFF
WEBKITGTK_CONF_OPTS += -DENABLE_SPEECH_SYNTHESIS=OFF
WEBKITGTK_CONF_OPTS += -DUSE_FLITE=OFF
WEBKITGTK_DEPENDENCIES += libnice gst1-plugins-good
# webrtcbin needs rtpbin (rtpmanager) + rtpfunnel (rtp). Frag/defconfig
# must keep GST1_PLUGINS_GOOD_PLUGIN_RTP and _RTPMANAGER=y.
# WebKit outgoing sources also need gst-plugins-base videorate +
# videotestsrc + audiotestsrc (clocksync is in coreelements).
# WebKit AudioSourceProviderGStreamer factory_make("deinterleave")
# with no NULL check — PLUGIN_INTERLEAVE must stay y.
# Meet DTLS vs JVB: dropin 0002-webrtc-dtls-pem-before-sdp sets PEM
# on dtlssrtpdec before SDP and fills generateCertificate sha-256
# fingerprints. Resume skips tree patches — keep the living 2.52.6
# sources in sync with 0002.
# gst1-plugins-bad dropin 0001-dtlsdec-rebind-peer-cert-after-pem
# rebinds dtlsdec on-peer-certificate after pem recreate
# (stock 1.24 only hooks NULL→READY).
endif
