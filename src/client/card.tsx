import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { CpaCardFace } from './controller.js'
import type { VisionModelChoice } from './controller.js'

type Props = PropsRuntime<'settings.plugin.item'> & PropsLocale<'dsh-cliproxyapi'> & InjectFace<CpaCardFace>

function Field(props: {
  id: string; label: string; hint: string; text: string; overridden: boolean; invalid: boolean; disabled: boolean
  type?: 'text' | 'number' | 'password' | 'select'; choices?: readonly VisionModelChoice[]; emptyLabel?: string; noReset?: boolean
  t: Props['t']; onEdit(text: string): void; onReset(): void
}) {
  return <div className="dcpa-field">
    <div className="dcpa-field-head">
      <label htmlFor={props.id}>{props.label}</label>
      {props.overridden && <span className="dcpa-badge">{props.t('overridden')}</span>}
      {!props.noReset && <button type="button" className="dcpa-reset" disabled={props.disabled} onClick={props.onReset}>{props.t('reset')}</button>}
    </div>
    {props.type === 'select'
      ? <select id={props.id} className="dcpa-input" disabled={props.disabled} value={props.text} onChange={event => { props.onEdit(event.target.value) }}>
          <option value="">{props.emptyLabel ?? ''}</option>{props.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
      : <input id={props.id} className="dcpa-input" type={props.type ?? 'text'} disabled={props.disabled} value={props.text} onChange={event => { props.onEdit(event.target.value) }} />}
    <div className="dcpa-hint">{props.invalid ? props.t('invalid') : props.hint}</div>
  </div>
}

export function CpaCard(props: Props) {
  const state = props.useCpaCard(snapshot => snapshot)
  if (!state.available) return null
  const disabled = !state.writable
  const field = (name: keyof typeof state, options: { label: Parameters<Props['t']>[0]; hint: Parameters<Props['t']>[0]; type?: 'text' | 'number' | 'select'; choices?: readonly VisionModelChoice[] }) => {
    const value = state[name] as typeof state.baseURL
    return <Field id={`dcpa-${String(name)}`} t={props.t} label={props.t(options.label)} hint={props.t(options.hint)} disabled={disabled}
      {...value} {...options.type === undefined ? {} : { type: options.type }} {...options.choices === undefined ? {} : { choices: options.choices }}
      onEdit={text => { props.edit(String(name), text) }} onReset={() => { props.resetField(String(name)) }} />
  }
  return <div className="dcpa-card">
    <h3>{props.t('title')}</h3><p className="dcpa-description">{props.t('description')}</p>
    <Field id="dcpa-api-key" t={props.t} label={props.t('apiKey')} hint={props.t('apiKeyHint')} type="password" noReset disabled={!state.apiKeyWritable}
      {...state.apiKey} onEdit={text => { props.edit('apiKey', text) }} onReset={() => {}} />
    <div className="dcpa-hint">{state.apiKeyConfigured ? props.t('apiKeySet') : props.t('apiKeyUnset')}</div>
    {field('enabled', { label: 'enabled', hint: 'enabledHint', type: 'select', choices: [{ value: 'true', label: props.t('yes') }, { value: 'false', label: props.t('no') }] })}
    {field('baseURL', { label: 'baseURL', hint: 'baseURLHint' })}
    {field('apiKeyEnv', { label: 'apiKeyEnv', hint: 'apiKeyEnvHint' })}
    <Field id="dcpa-visionModel" t={props.t} label={props.t('visionModel')}
      hint={state.modelLoadState === 'loading' ? props.t('modelsLoading') : state.modelLoadState === 'error' ? props.t('modelsFailed') : state.visionChoices.length === 0 ? props.t('modelsEmpty') : props.t('visionModelHint')}
      type="select" choices={state.visionChoices} emptyLabel={props.t('autoVision')} disabled={disabled || state.modelLoadState === 'loading' || state.visionChoices.length === 0}
      {...state.visionModel} onEdit={text => { props.edit('visionModel', text) }} onReset={() => { props.resetField('visionModel') }} />
    <button type="button" className="dcpa-button" disabled={state.modelLoadState === 'loading'} onClick={props.refreshModels}>{props.t('reloadModels')}</button>
    {field('protocol', { label: 'protocol', hint: 'protocolHint', type: 'select', choices: [{ value: 'openai-completions', label: 'OpenAI Chat Completions' }, { value: 'openai-responses', label: 'OpenAI Responses' }] })}
    {field('refreshIntervalSeconds', { label: 'refreshIntervalSeconds', hint: 'refreshIntervalSecondsHint', type: 'number' })}
    {field('probeTimeoutMs', { label: 'probeTimeoutMs', hint: 'probeTimeoutMsHint', type: 'number' })}
    <div className="dcpa-actions">
      {state.failed && <span className="dcpa-failed">{props.t('saveFailed')}</span>}
      {state.saving && <span className="dcpa-hint">{props.t('saving')}</span>}
      <button type="button" className="dcpa-button dcpa-primary" disabled={disabled || !state.dirty || state.invalid || state.saving} onClick={props.save}>{props.t('save')}</button>
      <button type="button" className="dcpa-button" disabled={!state.dirty || state.saving} onClick={props.discard}>{props.t('discard')}</button>
    </div>
  </div>
}
