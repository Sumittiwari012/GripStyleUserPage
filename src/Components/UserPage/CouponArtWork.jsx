import _ from 'lodash'
import { baseDesign } from '../TemplateLibrary/lib/design'

const API_BASE = 'https://dummypossetup.runasp.net'

export async function fetchCouponUiDesign(couponId, templateId) {
  const res = await fetch(
    `${API_BASE}/api/Coupon/GetCouponUi?couponId=${couponId}&templateId=${templateId}`
  )
  if (!res.ok) throw new Error(`Failed to load coupon artwork (${res.status}).`)
  const json = await res.json()
  const config = json && typeof json === 'object' && 'data' in json ? json.data : json
  const merged = _.merge(baseDesign(), config || {})
  merged.id = String(templateId)
  return merged
}

export function applyCouponOverrides(design, coupon) {
  if (!design) return null

  const couponCode = coupon?.couponUniqueCode

  const discountLabel =
    coupon?.discountPercentage > 0
      ? `${coupon.discountPercentage}%`
      : coupon?.discountAmount > 0
      ? `₹${coupon.discountAmount}`
      : design.medallion?.value

  // Use the coupon code itself as the QR value.
  // This ensures every printed coupon gets its own QR value.
  const qrValue = couponCode || design.qr?.value

  return {
    ...design,

    // Discount
    medallion: design.medallion
      ? {
          ...design.medallion,
          value: discountLabel,
        }
      : design.medallion,

    // QR
    qr: design.qr
      ? {
          ...design.qr,
          value: qrValue,
        }
      : design.qr,

    // QR text
    qrLabel: design.qrLabel
      ? {
          ...design.qrLabel,
          line1: couponCode || design.qrLabel.line1,
        }
      : design.qrLabel,

    // QR elements, if your template uses QR as an element
    elements: (design.elements || []).map((el) =>
      el.type === 'qr'
        ? {
            ...el,
            value: couponCode || el.value,
          }
        : el
    ),
  }
}
