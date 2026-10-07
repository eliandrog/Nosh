import markUrl from '../../assets/nosh-logo-mark.png'
import wordmarkUrl from '../../assets/nosh-wordmark.png'

export const APP_VERSION = '0.1.0'

/**
 * Brand lockup from the brand slide: mark above the wordmark, original colours and
 * proportions (PPT sizes 1.35×1.5in and 2.3×0.87in), at least the width of the "O" clear space.
 */
export function AboutNosh({ id }: { id?: string }) {
  return (
    <section id={id} className="about-nosh" aria-label="About Nosh">
      <div className="about-nosh__lockup">
        <img src={markUrl} alt="" className="about-nosh__mark" width={108} height={120} />
        <img src={wordmarkUrl} alt="Nosh, meal planning platform" className="about-nosh__wordmark" width={184} height={70} />
      </div>
      <p className="about-nosh__slogan">“No one should have to choose between eating well and making ends meet.”</p>
    </section>
  )
}
