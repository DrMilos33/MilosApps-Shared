# React Aria opt-in recipe

React Aria Components is preferred when an app needs a complex accessible
widget such as a date picker, combobox, menu or dialog. It is deliberately not
part of the baseline template.

Add the exact packages in the consuming app:

```powershell
pnpm add react-aria-components@1.20.0 @internationalized/date@3.12.3
```

Prefer documented subpath imports for the components actually used. Keep
domain values and MilosApps Custom Events behind an app-owned adapter instead
of exposing React state as a portfolio contract.

## CSP boundary

The stock React Aria popover/overlay composition positions elements with
dynamic inline `style` attributes. That is not compatible with a strict
`style-src 'self'` policy merely by adding a nonce. Do not silently weaken a
portfolio-wide CSP. Either keep the calendar/listbox in normal document flow,
provide an app-owned class-based overlay, or coordinate a narrowly scoped CSP
change for the affected route and test it explicitly.

## Interaction boundary

React Aria DateField and DatePicker use segmented date input. Do not assume
that compact raw input such as `13111995` is accepted. If an app requires known
date text entry, preserve that normal text field and use React Aria calendar
and keyboard primitives as progressive enhancement. Test raw input, paste,
year-first editing, invalid values, min/max, Enter, blur, Escape, clear and
calendar selection in a real browser.
