import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B0B0C",
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: 700,
          borderRadius: 6,
          letterSpacing: "-0.02em",
        }}
      >
        G
      </div>
    ),
    {
      ...size,
    }
  );
}
