"use client";

const SPRITE_COUNT = 440;

export default function ArtistSprite({
  spriteIndex,
  size = 40,
}: {
  spriteIndex: number;
  size?: number;
}) {
  const idx = ((spriteIndex % SPRITE_COUNT) + SPRITE_COUNT) % SPRITE_COUNT;
  return (
    <img
      src={`/sprites/${idx}.png`}
      alt="artist"
      width={size}
      height={size}
      className="block object-contain"
      style={{ imageRendering: "pixelated", width: size, height: size }}
      draggable={false}
    />
  );
}
