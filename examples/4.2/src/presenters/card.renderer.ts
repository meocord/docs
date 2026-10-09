// #region renderer
import { Column, Root, Text } from 'meo-canvas'
import { Service } from 'meocord/decorator'

/** Draws a card, a title over a message, as a PNG. */
@Service()
export class CardRenderer {
  async draw(title: string, message: string, accent: string): Promise<Uint8Array> {
    const canvas = await Root({
      width: 480,
      padding: 24,
      backgroundColor: '#1E1F22',
      children: Column({
        gap: 8,
        children: [
          Text(title, { fontSize: 22, fontWeight: 'bold', color: accent }),
          Text(message, { fontSize: 16, color: '#DBDEE1' }),
        ],
      }),
    })
    try {
      return await canvas.png
    } finally {
      canvas.release()
    }
  }
}
// #endregion renderer
