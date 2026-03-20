import MotionCanvas from "@/components/MotionCanvas";

const config = {
  colorA: "#4400FF",
  colorB: "#888888",
  speed: 1.0,
  density: 2,
  background: "#000000",
};

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <MotionCanvas config={config} />
    </main>
  );
}
