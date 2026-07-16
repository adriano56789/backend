import { EgressClient } from "livekit-server-sdk";

const c = new EgressClient("http://host.docker.internal:7880", "devkey", "secret");
console.log("EgressClient created");

try {
  const list = await c.listEgress({});
  console.log("listEgress OK, count:", list.length);
} catch(e) {
  console.error("listEgress FAIL:", e.message);
}

try {
  const { StreamOutput } = await import("@livekit/protocol");
  const info = await c.startRoomCompositeEgress("test_room_egress_check", {
    stream: new StreamOutput({
      urls: ["rtmp://srs:1935/live/test_egress"],
      protocol: 1
    })
  }, {
    layout: "speaker",
    encodingOptions: 2
  });
  console.log("startEgress OK:", info.egressId);
  if (info.egressId) {
    await c.stopEgress(info.egressId);
    console.log("stopEgress OK");
  }
} catch(e) {
  console.error("startEgress FAIL:", e.message);
}
