export function exportItemModel(): string {
  const model = {
    parent: 'builtin/generated',
    textures: {
      layer0: 'minecraft:item/stone',
    },
    display: {
      thirdperson_righthand: {
        rotation: [75, 45, 0],
        translation: [0, 2.5, 0],
        scale: [0.375, 0.375, 0.375],
      },
      firstperson_righthand: {
        rotation: [0, 45, 0],
        translation: [0, 0, 0],
        scale: [0.4, 0.4, 0.4],
      },
    },
  }

  return JSON.stringify(model, null, 2)
}
