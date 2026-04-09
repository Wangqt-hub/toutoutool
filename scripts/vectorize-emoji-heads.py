from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "public" / "loading-lab" / "emoji-heads"
OUTPUT_DIR = ROOT / "public" / "loading-lab" / "emoji-heads-svg"
MANIFEST_OUTPUT = ROOT / "src" / "lib" / "emoji-heads-svg.ts"
FILL_COLOR = "#6E3110"
ALPHA_THRESHOLD = 18
APPROX_EPSILON = 0.55
LAYER_ORDER = ("outline", "hair", "brows", "eyes", "nose", "mouth", "accent")


@dataclass(frozen=True, slots=True)
class PathProfile:
    minimum_epsilon: float
    epsilon_factor: float
    corner_angle_deg: float


@dataclass(slots=True)
class ComponentShape:
    area: int
    x: int
    y: int
    width: int
    height: int
    cx: float
    cy: float
    contours: tuple[np.ndarray, ...]


DEFAULT_PROFILE = PathProfile(
    minimum_epsilon=APPROX_EPSILON,
    epsilon_factor=0.003,
    corner_angle_deg=118.0,
)
OUTLINE_PROFILE = PathProfile(
    minimum_epsilon=0.48,
    epsilon_factor=0.0022,
    corner_angle_deg=132.0,
)

def turn_angle(
    previous_point: tuple[float, float],
    current_point: tuple[float, float],
    next_point: tuple[float, float],
) -> float:
    incoming = (
        previous_point[0] - current_point[0],
        previous_point[1] - current_point[1],
    )
    outgoing = (
        next_point[0] - current_point[0],
        next_point[1] - current_point[1],
    )
    incoming_length = math.hypot(*incoming)
    outgoing_length = math.hypot(*outgoing)
    if incoming_length == 0 or outgoing_length == 0:
        return 180.0

    dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
    cosine = max(-1.0, min(1.0, dot / (incoming_length * outgoing_length)))
    return math.degrees(math.acos(cosine))


def format_point(point: tuple[float, float]) -> str:
    return f"{point[0]:.1f},{point[1]:.1f}"


def contour_to_path(contour: np.ndarray, profile: PathProfile) -> str:
    epsilon = max(
        profile.minimum_epsilon,
        profile.epsilon_factor * cv2.arcLength(contour, True),
    )
    simplified = cv2.approxPolyDP(contour, epsilon, True)
    if len(simplified) < 3:
        return ""

    points = [tuple(map(float, point[0])) for point in simplified]
    midpoints = [
        (
            (points[index][0] + points[(index + 1) % len(points)][0]) / 2,
            (points[index][1] + points[(index + 1) % len(points)][1]) / 2,
        )
        for index in range(len(points))
    ]
    corner_flags = [
        turn_angle(points[index - 1], points[index], points[(index + 1) % len(points)])
        <= profile.corner_angle_deg
        for index in range(len(points))
    ]

    commands = [f"M{format_point(midpoints[-1])}"]
    for index, point in enumerate(points):
        if corner_flags[index]:
            commands.append(f"L{format_point(point)}")
            commands.append(f"L{format_point(midpoints[index])}")
        else:
            commands.append(
                f"Q{format_point(point)} {format_point(midpoints[index])}"
            )
    commands.append("Z")
    return " ".join(commands)


def extract_contours(component_mask: np.ndarray) -> tuple[np.ndarray, ...]:
    contours, _ = cv2.findContours(component_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    return tuple(contours)


def component_to_path(
    contours: tuple[np.ndarray, ...],
    profile: PathProfile,
) -> str:
    parts = [contour_to_path(contour, profile) for contour in contours]
    return " ".join(part for part in parts if part)


def classify_component(
    component: ComponentShape,
    largest_area: int,
    canvas_width: int,
    canvas_height: int,
) -> str:
    nx = component.cx / canvas_width
    ny = component.cy / canvas_height
    side = nx < 0.24 or nx > 0.76
    centered = 0.42 <= nx <= 0.58

    if component.area == largest_area:
        return "outline"

    if (
        nx >= 0.72
        and ny <= 0.46
        and component.area <= 1800
        and component.width >= 24
    ):
        return "accent"

    if side and 0.34 <= ny <= 0.76:
        return "outline"

    if ny <= 0.42 and 0.22 <= nx <= 0.78:
        return "hair"

    if centered and 0.45 <= ny <= 0.65 and component.area <= 180:
        return "nose"

    if centered and ny >= 0.58 and component.area >= 180:
        return "mouth"

    if 0.36 <= ny <= 0.58 and not centered and component.height <= 54 and component.area <= 1400:
        return "brows"

    if side and ny <= 0.48 and component.area <= 2400:
        return "eyes"

    if 0.44 <= ny <= 0.76:
        return "eyes"

    if centered and ny >= 0.5:
        return "mouth"

    return "eyes" if ny < 0.58 else "mouth"


def extract_components(mask: np.ndarray) -> list[ComponentShape]:
    component_count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
    components: list[ComponentShape] = []

    for index in range(1, component_count):
        x, y, width, height, area = stats[index]
        component_mask = np.where(labels == index, 255, 0).astype(np.uint8)
        contours = extract_contours(component_mask)
        if not contours:
            continue

        cx, cy = centroids[index]
        components.append(
            ComponentShape(
                area=int(area),
                x=int(x),
                y=int(y),
                width=int(width),
                height=int(height),
                cx=float(cx),
                cy=float(cy),
                contours=contours,
            )
        )

    return sorted(components, key=lambda component: (component.y, component.x))


def build_svg(mask: np.ndarray) -> tuple[dict[str, list[dict[str, str]]], str]:
    components = extract_components(mask)
    if not components:
        raise RuntimeError("No drawable components were found in the PNG.")

    largest_area = max(component.area for component in components)
    grouped: dict[str, list[ComponentShape]] = {layer: [] for layer in LAYER_ORDER}

    for component in components:
        layer_name = classify_component(
            component,
            largest_area,
            mask.shape[1],
            mask.shape[0],
        )
        grouped[layer_name].append(component)

    manifest_layers: dict[str, list[dict[str, str]]] = {}
    svg_groups: list[str] = []

    for layer_name in LAYER_ORDER:
        layer_components = grouped[layer_name]
        profile = OUTLINE_PROFILE if layer_name == "outline" else DEFAULT_PROFILE
        manifest_layers[layer_name] = [
            {
                "d": component_to_path(component.contours, profile),
                "fillRule": "evenodd",
            }
            for component in layer_components
        ]
        svg_groups.append(
            f'<g id="{layer_name}">'
            + "".join(
                f'<path fill="{FILL_COLOR}" fill-rule="evenodd" d="{component_to_path(component.contours, profile)}"/>'
                for component in layer_components
            )
            + "</g>"
        )

    view_box = f"0 0 {mask.shape[1]} {mask.shape[0]}"
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" fill="none">'
        f'{"".join(svg_groups)}'
        f"</svg>"
    )
    return manifest_layers, svg


def write_manifest(manifest_data: dict[str, object]) -> None:
    MANIFEST_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    manifest = (
        'export const emojiHeadLayerOrder = ["outline", "hair", "brows", "eyes", "nose", "mouth", "accent"] as const;\n\n'
        "export type EmojiHeadLayerName = (typeof emojiHeadLayerOrder)[number];\n\n"
        "export interface EmojiHeadLayerShape {\n"
        "  d: string;\n"
        '  fillRule: "evenodd";\n'
        "}\n\n"
        "export interface EmojiHeadLayerAsset {\n"
        "  viewBox: string;\n"
        "  layers: Record<EmojiHeadLayerName, EmojiHeadLayerShape[]>;\n"
        "}\n\n"
        f"export const emojiHeadLayers = {json.dumps(manifest_data, indent=2)} as const;\n\n"
        "export type EmojiHeadLayerKey = keyof typeof emojiHeadLayers;\n"
    )
    MANIFEST_OUTPUT.write_text(manifest, encoding="utf-8")


def vectorize_png(source: Path) -> tuple[str, dict[str, object], Path, int, int]:
    image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"Unable to read {source}")

    if image.ndim != 3 or image.shape[2] < 4:
        raise RuntimeError(f"{source} does not contain an alpha channel")

    alpha = image[:, :, 3]
    _, mask = cv2.threshold(alpha, ALPHA_THRESHOLD, 255, cv2.THRESH_BINARY)
    layers, svg = build_svg(mask)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / f"{source.stem}.svg"
    output.write_text(svg, encoding="utf-8")

    return (
        source.stem,
        {
            "viewBox": f"0 0 {mask.shape[1]} {mask.shape[0]}",
            "layers": layers,
        },
        output,
        source.stat().st_size,
        output.stat().st_size,
    )


def main() -> None:
    manifest_data: dict[str, object] = {}
    generated: list[tuple[Path, int, int]] = []

    for source in sorted(INPUT_DIR.glob("*.png")):
        key, asset, output, before, after = vectorize_png(source)
        manifest_data[key] = asset
        generated.append((output, before, after))

    write_manifest(manifest_data)

    for output, before, after in generated:
        print(f"{output.name}: {before} -> {after} bytes")


if __name__ == "__main__":
    main()
