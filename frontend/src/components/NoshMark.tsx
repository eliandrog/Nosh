import markUrl from '../assets/nosh-logo-mark-80.png'

/**
 * Small Nosh logo mark for page headers. Decorative (alt=""): the page title next to it is the
 * accessible name. Optimised 71×80 copy (12 KB) of the original mark, shown at 36×40 CSS px
 * (2× for sharp phone screens); never recoloured, stretched or rotated (object-fit keeps the ratio).
 */
export function NoshMark() {
  return <img className="nosh-mark" src={markUrl} alt="" width={36} height={40} />
}
