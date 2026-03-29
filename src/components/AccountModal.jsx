import { useEffect } from 'react'
import { Icon } from '@iconify/react'

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

function AccountModal({
  open,
  onClose,
  onApply,
  onManageAccount,
  onYearChange,
  onTdChange,
  onTpChange,
  displayInfo,
  profilePhotoSrc,
  planningState,
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

  if (planningState.booting) {
    return (
      <div
        className="weather-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-backdrop p-5 animate-modal-backdrop-in max-sm:p-[14px]"
        onClick={onClose}
        role="presentation"
      >
        <section
          className="account-modal-card h-[444px] w-[min(569px,100%)] rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] animate-modal-card-in"
          role="dialog"
          aria-modal="true"
          aria-label="Chargement du compte"
          onClick={(event) => event.stopPropagation()}
        >
          <div key="booting" className="account-modal-layout-panel flex h-full flex-col items-center justify-center gap-4 p-[21px] text-center">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[var(--color-border)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              <Icon icon="carbon:user-avatar" className="h-7 w-7 text-[var(--color-text)]" aria-hidden="true" />
            </div>
            <AccountModalLoadingDots label={planningState.bootingMessage || 'Chargement des infos du profil...'} />
          </div>
        </section>
      </div>
    )
  }

  const yearOptions = buildSelectOptions(planningState.yearOptions, planningState.draftYear)
  const tdOptions = buildSelectOptions(planningState.tdOptions, planningState.draftTd)
  const tpOptions = buildSelectOptions(planningState.tpOptions, planningState.draftTp)

  const isPlanningBusy = planningState.loading || planningState.applying
  const isTdDisabled = isPlanningBusy || !planningState.draftYear
  const isTpDisabled = isPlanningBusy || !planningState.draftTd
  const canApply = Boolean(planningState.draftYear)
    && (!planningState.tdOptions.length || planningState.draftTd)
    && (!planningState.tpOptions.length || planningState.draftTp)
    && !isPlanningBusy
  const shouldShowPlanningLoader = planningState.loading

  const loadingPlaceholder = isPlanningBusy ? 'Chargement...' : 'Choisir'

  return (
    <div
      className="weather-modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-backdrop p-5 animate-modal-backdrop-in max-sm:p-[14px]"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="account-modal-card flex h-[444px] w-[min(569px,100%)] max-h-[calc(100vh-40px)] flex-col overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] animate-modal-card-in max-sm:h-auto max-sm:max-h-[calc(100vh-28px)]"
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

            {planningState.errorMessage ? (
              <p className="m-0 font-body text-[13px] font-semibold leading-[1.2] text-[#b91c1c] dark:text-[var(--color-error)]">
                {planningState.errorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex w-full items-end justify-end gap-[10px] p-[21px] max-sm:flex-col max-sm:items-stretch">
            <button
              type="button"
              className="inline-flex h-[42px] w-[103.84px] items-center justify-center rounded-[53px] border-0 bg-[#111827] px-[18px] font-body text-[15px] font-normal leading-[24px] text-[#fcfbf8] transition-opacity duration-[120ms] ease-in-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--color-text)] dark:text-[var(--color-bg)] max-sm:w-full"
              onClick={onApply}
              disabled={!canApply}
            >
              {planningState.applying ? '...' : 'Appliquer'}
            </button>

            <button
              type="button"
              className="inline-flex h-[46px] items-center justify-center rounded-full border border-white bg-white px-[13px] font-display text-[16px] font-normal leading-[24px] tracking-[-0.3125px] text-[var(--color-text)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors duration-[120ms] ease-in-out hover:bg-[#f8f7f3] dark:border-[var(--color-border)] dark:bg-[var(--color-bg-surface)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] dark:hover:bg-[var(--color-bg-subtle)] max-sm:w-full"
              onClick={onManageAccount}
            >
              Gérer mon compte sur Sésame
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AccountModal
