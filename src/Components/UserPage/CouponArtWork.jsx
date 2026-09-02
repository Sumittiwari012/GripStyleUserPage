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
  const discountLabel =
    coupon.discountPercentage > 0
      ? `${coupon.discountPercentage}%`
      : coupon.discountAmount > 0
      ? `₹${coupon.discountAmount}`
      : design.medallion?.value

  return {
    ...design,
    medallion: design.medallion && { ...design.medallion, value: discountLabel },
    qr: design.qr && {
      ...design.qr,
      value: coupon.couponUniqueCode
        ? `${design.qr.value}${design.qr.value.includes('?') ? '&' : '?'}code=${encodeURIComponent(coupon.couponUniqueCode)}`
        : design.qr.value,
    },
  }
}