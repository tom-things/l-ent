import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { AboutContent } from './AboutModal'

function buildSelectOptions(options, selectedOption) {
  const normalizedOptions = Array.isArray(options) ? [...options] : []

  if (
    selectedOption?.resourceId
    && !normalizedOptions.some((option) => option.resourceId === selectedOption.resourceId)
  ) {
    normalizedOptions.unshift(selectedOption)
  }

  return normalizedOptions
}

function AccountModalLoadingDots({ label }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-[10px] text-center text-[13px] font-medium leading-none text-[rgba(17,24,39,0.62)] dark:text-[rgba(255,255,255,0.5)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="inline-flex items-center justify-center gap-[6px] text-current" aria-hidden="true">
        <span className="lent-button-dot h-[5px] w-[5px] rounded-full bg-current" style={{ animationDelay: '0ms' }} />
        <span className="lent-button-dot h-[5px] w-[5px] rounded-full bg-current" style={{ animationDelay: '140ms' }} />
        <span className="lent-button-dot h-[5px] w-[5px] rounded-full bg-current" style={{ animationDelay: '280ms' }} />
      </span>
      <span className="font-body">{label}</span>
    </div>
  )
}

// Knob is intentionally larger than the 26px track so it pokes out above and
// below the bar, and the blue fill runs up to its trailing edge — the circle
// visually caps the end of the progress bar.
const STEP_SLIDER_KNOB_PX = 34

function clampIndex(index, count) {
  if (index < 0) {
    return 0
  }
  if (index > count - 1) {
    return count - 1
  }
  return index
}

function findNearestIndex(options, value) {
  const exactIndex = options.indexOf(value)
  if (exactIndex !== -1) {
    return exactIndex
  }

  let nearestIndex = 0
  let nearestDistance = Infinity
  options.forEach((option, index) => {
    const distance = Math.abs(option - value)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  return nearestIndex
}

// Discrete pill slider (see the account modal "prochain cours" setting):
// a rounded track with a blue fill up to a draggable white knob and a tick
// dot for every available step.
function StepSlider({ options, value, onChange, ariaLabel, disabled = false }) {
  const trackRef = useRef(null)
  const pressedRef = useRef(false)
  const [dragRatio, setDragRatio] = useState(null)
  const isDragging = dragRatio != null

  const count = options.length
  const activeIndex = findNearestIndex(options, value)
  const stepRatio = count > 1 ? activeIndex / (count - 1) : 0
  // While dragging, the knob tracks the pointer 1:1; otherwise it sits on the
  // active step (and CSS-animates towards it).
  const displayRatio = dragRatio ?? stepRatio

  const commitIndex = useCallback((nextIndex) => {
    const safeIndex = clampIndex(nextIndex, count)
    const nextValue = options[safeIndex]
    if (nextValue !== value) {
      onChange(nextValue)
    }
  }, [count, onChange, options, value])

  const ratioFromClientX = useCallback((clientX) => {
    const track = trackRef.current
    if (!track || count <= 1) {
      return null
    }

    const rect = track.getBoundingClientRect()
    const railWidth = rect.width - STEP_SLIDER_KNOB_PX
    if (railWidth <= 0) {
      return null
    }

    const rawRatio = (clientX - rect.left - STEP_SLIDER_KNOB_PX / 2) / railWidth
    return Math.min(1, Math.max(0, rawRatio))
  }, [count])

  const handlePointerDown = useCallback((event) => {
    if (disabled) {
      return
    }

    const ratio = ratioFromClientX(event.clientX)
    if (ratio == null) {
      return
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
    pressedRef.current = true
    // A simple press glides the knob to the tapped step; free-form dragging
    // only starts once the pointer moves.
    commitIndex(Math.round(ratio * (count - 1)))
  }, [commitIndex, count, disabled, ratioFromClientX])

  const handlePointerMove = useCallback((event) => {
    if (!pressedRef.current) {
      return
    }

    const ratio = ratioFromClientX(event.clientX)
    if (ratio == null) {
      return
    }

    setDragRatio(ratio)
    commitIndex(Math.round(ratio * (count - 1)))
  }, [commitIndex, count, ratioFromClientX])

  const endDragging = useCallback((event) => {
    if (event?.pointerId != null) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    pressedRef.current = false
    // Releasing lets the knob snap-animate from the pointer to its step.
    setDragRatio(null)
  }, [])

  const handleKeyDown = useCallback((event) => {
    if (disabled) {
      return
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault()
        commitIndex(activeIndex - 1)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault()
        commitIndex(activeIndex + 1)
        break
      case 'Home':
        event.preventDefault()
        commitIndex(0)
        break
      case 'End':
        event.preventDefault()
        commitIndex(count - 1)
        break
      default:
        break
    }
  }, [activeIndex, commitIndex, count, disabled])

  const knobLeft = `calc(${STEP_SLIDER_KNOB_PX / 2}px + (100% - ${STEP_SLIDER_KNOB_PX}px) * ${displayRatio})`
  // Fill runs to the knob's trailing edge, so the knob always caps the bar.
  const fillWidth = `calc(${STEP_SLIDER_KNOB_PX}px + (100% - ${STEP_SLIDER_KNOB_PX}px) * ${displayRatio})`
  const snapEasing = 'cubic-bezier(0.22, 1, 0.36, 1)'

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemin={options[0]}
      aria-valuemax={options[count - 1]}
      aria-valuenow={value}
      aria-valuetext={`${value} jours`}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDragging}
      onPointerCancel={endDragging}
      onKeyDown={handleKeyDown}
      className={`relative h-[26px] w-full touch-none select-none rounded-full bg-[#e7e4dc] outline-none transition-shadow dark:bg-[var(--color-bg-muted)] ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} focus-visible:ring-2 focus-visible:ring-brand/45`}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-brand"
        style={{ width: fillWidth, transition: isDragging ? 'none' : `width 260ms ${snapEasing}` }}
        aria-hidden="true"
      />

      {options.map((option, index) => {
        const dotRatio = count > 1 ? index / (count - 1) : 0
        const isFilled = index <= activeIndex
        return (
          <span
            key={option}
            className={`pointer-events-none absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200 ${isFilled ? 'bg-white/75' : 'bg-black/25 dark:bg-white/25'}`}
            style={{ left: `calc(${STEP_SLIDER_KNOB_PX / 2}px + (100% - ${STEP_SLIDER_KNOB_PX}px) * ${dotRatio})` }}
            aria-hidden="true"
          />
        )
      })}

      <span
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border border-black/5 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.28)] ${isDragging ? 'scale-110' : ''} ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`}
        style={{
          left: knobLeft,
          height: `${STEP_SLIDER_KNOB_PX}px`,
          width: `${STEP_SLIDER_KNOB_PX}px`,
          transition: isDragging ? 'transform 160ms ease' : `left 260ms ${snapEasing}, transform 160ms ease`,
        }}
        aria-hidden="true"
      />
    </div>
  )
}

function AccountModal({
  open,
  onClose,
  onManageAccount,
  onYearChange,
  onTdChange,
  onTpChange,
  displayInfo,
  profilePhotoSrc,
  planningState,
  lookaheadDays,
  lookaheadOptions,
  onLookaheadChange,
}) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const yearOptions = buildSelectOptions(planningState.yearOptions, planningState.draftYear)
  const tdOptions = buildSelectOptions(planningState.tdOptions, planningState.draftTd)
  const tpOptions = buildSelectOptions(planningState.tpOptions, planningState.draftTp)

  const isPlanningBusy = planningState.loading || planningState.applying
  const isTdDisabled = isPlanningBusy || !planningState.draftYear
  const isTpDisabled = isPlanningBusy || !planningState.draftTd
  // Only swap the planning selects for the loading dots when there is nothing
  // stored to show — with a stored selection the selects render immediately
  // (disabled) while ADE loads in the background.
  const shouldShowPlanningLoader = planningState.loading && !planningState.draftYear

  const loadingPlaceholder = isPlanningBusy ? 'Chargement...' : 'Choisir'

  const canConfigureLookahead = typeof onLookaheadChange === 'function'
    && Array.isArray(lookaheadOptions)
    && lookaheadOptions.length > 1
  const lookaheadStepCount = canConfigureLookahead ? lookaheadOptions.length : 0

  return (
    <div
      className="weather-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-backdrop p-5 animate-modal-backdrop-in max-sm:p-[14px]"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="account-modal-card flex h-[572px] w-[min(569px,100%)] max-h-[calc(100vh-40px)] flex-col overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] animate-modal-card-in max-sm:h-auto max-sm:max-h-[calc(100vh-28px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div key="content" className="account-modal-layout-panel flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between px-[21px] pb-[10px] pt-[21px]">
            <h2
              id="account-modal-title"
              className="m-0 font-body text-[26.4px] font-bold leading-[26.6px] tracking-[-0.28px] text-[var(--color-text)]"
            >
              Mon compte
              <span className="ml-[7px] text-[15px] font-medium tracking-normal text-text-secondary">et préférences</span>
            </h2>

            <button
              type="button"
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[rgba(27,27,27,0.16)] bg-[#f3f1eb] p-0 text-[var(--color-text)] transition-colors duration-[120ms] ease-in-out hover:bg-[#edebe5] dark:border-[var(--color-border)] dark:bg-[var(--color-bg-muted)] dark:hover:bg-[var(--color-bg-subtle)]"
              onClick={onClose}
              aria-label="Fermer la modale de compte"
            >
              <Icon icon="carbon:close" className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto px-[21px] pb-[21px]">
            <div className="flex items-center gap-[25px] rounded-[23px] border border-white bg-white p-[21px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-[var(--color-border)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] max-sm:flex-col max-sm:items-start">
              <div className="flex h-[97px] w-[97px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(27,27,27,0.16)] bg-[#f3f1eb] dark:border-[var(--color-border)] dark:bg-[var(--color-bg-muted)]">
                {profilePhotoSrc ? (
                  <img
                    className="h-full w-full object-cover"
                    src={profilePhotoSrc}
                    alt={`Photo de profil de ${displayInfo.firstName || displayInfo.email || 'l’utilisateur'}`}
                  />
                ) : (
                  <Icon icon="carbon:user-avatar-filled-alt" className="h-10 w-10 text-[var(--color-text)]" aria-hidden="true" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-[10px] text-[var(--color-text)]">
                <div className="grid w-full grid-cols-2 gap-[10px] max-sm:grid-cols-1">
                  <div className="min-w-0">
                    <p className="m-0 font-body text-[14px] font-semibold leading-[14px]">Prénom</p>
                    <p className="m-0 truncate font-body text-[16px] font-normal leading-[24px]">
                      {displayInfo.firstName || '—'}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="m-0 font-body text-[14px] font-semibold leading-[14px]">Nom</p>
                    <p className="m-0 truncate font-body text-[16px] font-normal leading-[24px]">
                      {displayInfo.lastName || '—'}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="m-0 font-body text-[14px] font-semibold leading-[14px]">Adresse mail</p>
                  <p className="m-0 truncate font-body text-[16px] font-normal leading-[24px]">
                    {displayInfo.email || '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-[var(--color-border)]" aria-hidden="true" />

            <div className="flex flex-col gap-[10px]">
              <div className="flex h-[17px] items-center gap-[5px]">
                <Icon icon="carbon:calendar" className="h-[17px] w-[17px] shrink-0 text-[var(--color-text)]" aria-hidden="true" />
                <p className="m-0 font-display text-[16px] font-medium leading-[16.96px] tracking-[-0.3125px] text-[var(--color-text)]">
                  Planning
                </p>
              </div>

              <div key={shouldShowPlanningLoader ? 'planning-loading' : 'planning-ready'} className="account-modal-layout-panel account-modal-layout-panel--compact min-h-[65px]">
                {shouldShowPlanningLoader ? (
                  <div className="flex h-[65px] w-full items-center justify-center">
                    <AccountModalLoadingDots label={planningState.loadingMessage || 'Chargement ADE...'} />
                  </div>
                ) : (
                  <div className="grid w-full grid-cols-3 gap-[10px] max-sm:grid-cols-1">
                    <label className="flex min-w-0 flex-col gap-[5px]">
                      <span className="font-body text-[14px] font-semibold leading-[14px] text-[var(--color-text)]">Année</span>
                      <div className="relative">
                        <select
                          className="h-[46px] w-full appearance-none rounded-full border border-white bg-white pl-[13px] pr-10 font-display text-[16px] font-medium leading-[24px] tracking-[-0.3125px] text-[var(--color-text)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] outline-none disabled:cursor-wait disabled:opacity-60 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                          value={planningState.draftYear?.resourceId ?? ''}
                          onChange={(event) => onYearChange(event.target.value)}
                          disabled={isPlanningBusy || yearOptions.length === 0}
                        >
                          <option value="" disabled>{loadingPlaceholder}</option>
                          {yearOptions.map((option) => (
                            <option key={option.resourceId} value={option.resourceId}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Icon icon="carbon:chevron-down" className="pointer-events-none absolute right-[13px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--color-text)]" aria-hidden="true" />
                      </div>
                    </label>

                    <label className="flex min-w-0 flex-col gap-[5px]">
                      <span className="font-body text-[14px] font-semibold leading-[14px] text-[var(--color-text)]">Classe TD</span>
                      <div className="relative">
                        <select
                          className="h-[46px] w-full appearance-none rounded-full border border-white bg-white pl-[13px] pr-10 font-display text-[16px] font-medium leading-[24px] tracking-[-0.3125px] text-[var(--color-text)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] outline-none disabled:cursor-wait disabled:opacity-60 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                          value={planningState.draftTd?.resourceId ?? ''}
                          onChange={(event) => onTdChange(event.target.value)}
                          disabled={isTdDisabled}
                        >
                          <option value="" disabled>{loadingPlaceholder}</option>
                          {tdOptions.map((option) => (
                            <option key={option.resourceId} value={option.resourceId}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Icon icon="carbon:chevron-down" className="pointer-events-none absolute right-[13px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--color-text)]" aria-hidden="true" />
                      </div>
                    </label>

                    <label className="flex min-w-0 flex-col gap-[5px]">
                      <span className="font-body text-[14px] font-semibold leading-[14px] text-[var(--color-text)]">Classe TP</span>
                      <div className="relative">
                        <select
                          className="h-[46px] w-full appearance-none rounded-full border border-white bg-white pl-[13px] pr-10 font-display text-[16px] font-medium leading-[24px] tracking-[-0.3125px] text-[var(--color-text)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] outline-none disabled:cursor-wait disabled:opacity-60 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                          value={planningState.draftTp?.resourceId ?? ''}
                          onChange={(event) => onTpChange(event.target.value)}
                          disabled={isTpDisabled}
                        >
                          <option value="" disabled>{loadingPlaceholder}</option>
                          {tpOptions.map((option) => (
                            <option key={option.resourceId} value={option.resourceId}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Icon icon="carbon:chevron-down" className="pointer-events-none absolute right-[13px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--color-text)]" aria-hidden="true" />
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {canConfigureLookahead ? (
              <>
                <div className="h-px w-full bg-[var(--color-border)]" aria-hidden="true" />

                <div className="flex flex-col gap-[12px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-[17px] items-center gap-[5px]">
                      <Icon icon="carbon:time" className="h-[17px] w-[17px] shrink-0 text-[var(--color-text)]" aria-hidden="true" />
                      <p className="m-0 font-display text-[16px] font-medium leading-[16.96px] tracking-[-0.3125px] text-[var(--color-text)]">
                        Prochain cours
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#f3f1eb] px-[10px] py-[3px] font-body text-[13px] font-semibold leading-none text-[var(--color-text)] dark:bg-[var(--color-bg-muted)]">
                      {lookaheadDays} jours
                    </span>
                  </div>

                  <p className="m-0 font-body text-[14px] font-medium leading-[1.35] text-[rgba(17,24,39,0.62)] dark:text-[rgba(255,255,255,0.5)]">
                    Jusqu’où chercher un cours à venir dans l’emploi du temps.
                  </p>

                  <StepSlider
                    options={lookaheadOptions}
                    value={lookaheadDays}
                    onChange={onLookaheadChange}
                    ariaLabel="Nombre de jours de recherche du prochain cours"
                  />

                  <div className="relative h-[15px]" aria-hidden="true">
                    {lookaheadOptions.map((option, index) => (
                      <span
                        key={option}
                        className="absolute top-0 -translate-x-1/2 font-body text-[12px] font-medium leading-none text-[rgba(17,24,39,0.5)] dark:text-[rgba(255,255,255,0.4)]"
                        style={{ left: `calc(${STEP_SLIDER_KNOB_PX / 2}px + (100% - ${STEP_SLIDER_KNOB_PX}px) * ${lookaheadStepCount > 1 ? index / (lookaheadStepCount - 1) : 0})` }}
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {planningState.errorMessage ? (
              <p className="m-0 font-body text-[13px] font-semibold leading-[1.2] text-[#b91c1c] dark:text-[var(--color-error)]">
                {planningState.errorMessage}
              </p>
            ) : null}

            <div className="h-px w-full bg-[var(--color-border)]" aria-hidden="true" />

            <div className="flex flex-col gap-[10px]">
              <div className="flex h-[17px] items-center gap-[5px]">
                <Icon icon="carbon:information" className="h-[17px] w-[17px] shrink-0 text-[var(--color-text)]" aria-hidden="true" />
                <p className="m-0 font-display text-[16px] font-medium leading-[16.96px] tracking-[-0.3125px] text-[var(--color-text)]">
                  À propos
                </p>
              </div>

              <AboutContent />
            </div>
          </div>

          {typeof onManageAccount === 'function' ? (
            <div className="flex w-full items-end justify-end gap-[10px] p-[21px] max-sm:flex-col max-sm:items-stretch">
              <button
                type="button"
                className="inline-flex h-[46px] items-center justify-center rounded-full border border-white bg-white px-[13px] font-display text-[16px] font-normal leading-[24px] tracking-[-0.3125px] text-[var(--color-text)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors duration-[120ms] ease-in-out hover:bg-[#f8f7f3] dark:border-[var(--color-border)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] dark:hover:bg-[var(--color-bg-subtle)] max-sm:w-full"
                onClick={onManageAccount}
              >
                Gérer mon compte sur Sésame
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default AccountModal
