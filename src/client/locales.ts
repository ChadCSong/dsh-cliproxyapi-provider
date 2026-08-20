import type {} from '@deepseek-ai/dsh-client-ui-slots'

export const LOCALE_NS = 'dsh-cliproxyapi'

export type LocaleKey =
  | 'title' | 'description' | 'enabled' | 'enabledHint' | 'apiKey' | 'apiKeyHint' | 'apiKeySet' | 'apiKeyUnset'
  | 'apiKeyEnv' | 'apiKeyEnvHint' | 'baseURL' | 'baseURLHint' | 'visionModel' | 'visionModelHint'
  | 'protocol' | 'protocolHint' | 'refreshIntervalSeconds' | 'refreshIntervalSecondsHint'
  | 'probeTimeoutMs' | 'probeTimeoutMsHint' | 'overridden' | 'reset' | 'invalid' | 'save' | 'discard' | 'saving' | 'saveFailed'
  | 'yes' | 'no' | 'autoVision' | 'modelsLoading' | 'modelsEmpty' | 'modelsFailed' | 'reloadModels'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'dsh-cliproxyapi': LocaleKey }
}

export const zh: Record<LocaleKey, string> = {
  title: 'CLIProxyAPI（自动探测）',
  description: '自动发现本机 CPA、同步模型到原生模型选择器，并用所选读图模型辅助文本主模型理解图片。',
  enabled: '启用', enabledHint: '关闭后移除本插件管理的 CPA provider。',
  apiKey: 'CPA API Key', apiKeyHint: '写入 DSH 凭据存储，不会写入 settings.yaml。', apiKeySet: '已配置', apiKeyUnset: '未配置',
  apiKeyEnv: '密钥引用名', apiKeyEnvHint: '默认 CLIPROXYAPI_API_KEY。',
  baseURL: 'CPA 地址（可选）', baseURLHint: '留空自动扫描 127.0.0.1 / localhost / ::1 的 8317 端口。',
  visionModel: '读图模型', visionModelHint: '从当前 CPA 模型中选择；文本主模型遇到图片时，插件会先用它生成图片描述。',
  protocol: '推理协议', protocolHint: '默认 Chat Completions；CPA 部署要求 Responses 时可切换。',
  refreshIntervalSeconds: '自动刷新间隔（秒）', refreshIntervalSecondsHint: '默认 300，最小 15。',
  probeTimeoutMs: '单地址探测超时（毫秒）', probeTimeoutMsHint: '默认 2000。',
  overridden: '已覆盖', reset: '重置', invalid: '无效值', save: '保存', discard: '放弃修改', saving: '保存中…', saveFailed: '保存未全部生效',
  yes: '是', no: '否', autoVision: '自动选择', modelsLoading: '正在根据地址和 API Key 获取模型…', modelsEmpty: '填完地址和 API Key 后会自动列出模型。', modelsFailed: '模型获取失败，请检查地址和 API Key。', reloadModels: '重新获取模型',
}

export const en: Record<LocaleKey, string> = {
  title: 'CLIProxyAPI (auto discovery)',
  description: 'Discovers local CPA, synchronizes its catalog, and lets a selected vision model preprocess images for text-only main models.',
  enabled: 'Enabled', enabledHint: 'Disabling removes the CPA provider managed by this plugin.',
  apiKey: 'CPA API key', apiKeyHint: 'Stored in DSH credentials, never in settings.yaml.', apiKeySet: 'configured', apiKeyUnset: 'not configured',
  apiKeyEnv: 'Credential reference', apiKeyEnvHint: 'Defaults to CLIPROXYAPI_API_KEY.',
  baseURL: 'CPA URL (optional)', baseURLHint: 'Leave empty to scan port 8317 on 127.0.0.1, localhost, and ::1.',
  visionModel: 'Vision model', visionModelHint: 'Choose from the CPA catalog. It describes images before a text-only main model runs.',
  protocol: 'Inference protocol', protocolHint: 'Chat Completions by default; switch when the CPA deployment requires Responses.',
  refreshIntervalSeconds: 'Refresh interval (seconds)', refreshIntervalSecondsHint: 'Default 300; minimum 15.',
  probeTimeoutMs: 'Probe timeout per URL (ms)', probeTimeoutMsHint: 'Default 2000.',
  overridden: 'overridden', reset: 'reset', invalid: 'invalid value', save: 'Save', discard: 'Discard', saving: 'Saving…', saveFailed: 'Save did not fully land',
  yes: 'Yes', no: 'No', autoVision: 'Auto select', modelsLoading: 'Loading models from the URL and API key…', modelsEmpty: 'Enter the URL and API key to list models automatically.', modelsFailed: 'Could not load models; check the URL and API key.', reloadModels: 'Reload models',
}
