interface Tab<T extends string> { id: T; label: string }
interface Props<T extends string> {
  label: string
  value: T
  tabs: readonly Tab<T>[]
  onChange: (value: T) => void
}

/** Small, explicit information slices inside a mobile task. */
export default function MobileDetailNavigation<T extends string>({
  label, value, tabs, onChange
}: Props<T>) {
  return <nav className="mobile-detail-nav" aria-label={label}>
    {tabs.map(tab => <button type="button" key={tab.id}
      aria-current={value===tab.id?'page':undefined}
      onClick={()=>onChange(tab.id)}>{tab.label}</button>)}
  </nav>
}
