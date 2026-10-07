import type { ShoppingItem } from '../../api/types'
import { formatAmount } from '../../lib/shopping'
import { CheckIcon } from '../icons'

type Props = {
  item: ShoppingItem
  onToggle: (item: ShoppingItem) => void
}

/** One line: 44px checkbox, name, "used in" recipes and amount. Ticked = in the basket. */
export function ShoppingItemRow({ item, onToggle }: Props) {
  const amount = formatAmount(item)
  return (
    <li className={`shop-item${item.ticked ? ' shop-item--ticked' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.ticked}
        aria-label={`${item.name}, ${amount}`}
        className="shop-item__check"
        onClick={() => onToggle(item)}
      >
        {item.ticked && <CheckIcon size={18} />}
      </button>
      <span className="shop-item__text">
        <span className="shop-item__name">{item.name}</span>
        {item.usedIn.length > 0 && <span className="shop-item__used">{item.usedIn.join(', ')}</span>}
      </span>
      <span className="shop-item__amount">{amount}</span>
    </li>
  )
}
