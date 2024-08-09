import { Line } from "@codemirror/state";
import { off } from "process";

const TS_BLUE = "#3178C6";
const TS_MID = "#235A97";
const TS_LIGHT = "#358EF1";
const TS_DARK = "#00273F";
const GRAPHQL_RHODAMINE = "#E10098";
const GRAPHQL_MID = "rgb(196 56 150)";

const OFFSET = 20;

function calculateHexagonPoints(): { x: number; y: number }[] {
  const width = 100;
  const height = 100;

  const centerX = width / 2;
  const centerY = height / 2;

  const radius = height / 2;

  const points: { x: number; y: number }[] = [];

  // Calculate the angle offset (30 degrees in radians)
  const angleOffset = Math.PI / 6;

  // Calculate the points of the hexagon
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + angleOffset;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    points.push({ x, y });
  }

  return points;
}

function offset(pos) {
  return { x: pos.x + OFFSET, y: pos.y + OFFSET };
}

export function GratsLogo({ opacity = 1 }) {
  // Compute points of the hexagon with points
  // at the middle top and bottom
  const points = calculateHexagonPoints().map(offset);
  const lowerRight = points[0];
  const bottom = points[1];
  const lowerLeft = points[2];
  const upperLeft = points[3];
  const top = points[4];
  const upperRight = points[5];
  const center = offset({ x: 50, y: 50 });

  const tsLinesColor = GRAPHQL_MID;
  const gqlColor = GRAPHQL_RHODAMINE;

  const gqlWidth = 8;
  const tsWidth = 12;

  const showGradient = true;
  const gradient180 = "grad180";
  const gradient0 = "grad0";
  const gradient45 = "grad45";
  return (
    <svg
      width={100 + OFFSET * 2}
      height={100 + OFFSET * 2}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <LinearGradient
          angle={120}
          startColor={TS_LIGHT}
          endColor={TS_LIGHT}
          id={gradient45}
        />
        <LinearGradient
          angle={45}
          startColor={TS_BLUE}
          endColor={TS_BLUE}
          id={gradient180}
        />
        <LinearGradient
          angle={180}
          startColor={TS_LIGHT}
          endColor={TS_LIGHT}
          id={gradient0}
        />
      </defs>
      {showGradient && (
        <>
          <Polygon
            opacity={opacity}
            fill={`url(#${gradient180})`}
            points={[upperLeft, center, bottom, lowerLeft]}
          />
          <Polygon
            opacity={opacity}
            fill={`url(#${gradient45})`}
            points={[upperLeft, top, upperRight, center]}
          />
          <Polygon
            opacity={opacity}
            fill={`url(#${gradient0})`}
            points={[upperRight, lowerRight, bottom, center]}
          />
        </>
      )}

      {false && (
        <>
          <Polyline
            points={[upperRight, top]}
            stroke={gqlColor}
            strokeWidth={gqlWidth}
            fill="none"
          />
          <Polyline
            points={[center, upperLeft]}
            stroke={gqlColor}
            strokeWidth={gqlWidth}
            fill="none"
          />
          <Polyline
            points={[center, bottom]}
            stroke={gqlColor}
            strokeWidth={gqlWidth}
            fill="none"
          />
        </>
      )}
      <>
        {/* Draw the TS color */}
        <Dot center={center} r={tsWidth} fill={tsLinesColor} />
        <Dot center={top} r={tsWidth} fill={tsLinesColor} />
        <Polyline
          points={[
            center,
            upperRight,
            lowerRight,
            bottom,
            lowerLeft,
            upperLeft,
            top,
          ]}
          stroke={tsLinesColor}
          strokeWidth={tsWidth}
          fill="none"
        />
      </>
    </svg>
  );
}

function Dot({ center, ...rest }) {
  return <circle cx={center.x} cy={center.y} {...rest} />;
}

function Polyline({ points, ...rest }) {
  return (
    <polyline
      points={points.map((pos) => `${pos.x}, ${pos.y}`).join(" ")}
      {...rest}
    />
  );
}

function Polygon({ points, ...rest }) {
  return (
    <polygon
      points={points.map((pos) => `${pos.x}, ${pos.y}`).join(" ")}
      {...rest}
    />
  );
}

const calculateGradientDirection = (angle) => {
  const rad = (angle * Math.PI) / 180;
  const x1 = 50 + Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 - Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;

  return { x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%` };
};

function LinearGradient({ angle, startColor, endColor, id }) {
  const { x1, y1, x2, y2 } = calculateGradientDirection(angle);

  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0%" style={{ stopColor: startColor, stopOpacity: 1 }} />
      <stop offset="100%" style={{ stopColor: endColor, stopOpacity: 1 }} />
    </linearGradient>
  );
}
