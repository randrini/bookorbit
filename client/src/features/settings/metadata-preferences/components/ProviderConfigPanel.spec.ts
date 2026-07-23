import { mount } from '@vue/test-utils'
import type { ProviderConfigurations } from '@bookorbit/types'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ProviderConfigPanel from './ProviderConfigPanel.vue'

function configWithoutLibroFm(): ProviderConfigurations {
  return {
    google: { enabled: false, apiKey: '' },
    amazon: { enabled: false, domain: 'amazon.com', cookie: '' },
    goodreads: { enabled: false },
    hardcover: { enabled: false, apiKey: '' },
    openLibrary: { enabled: false },
    itunes: { enabled: false, coverResolution: 'high' },
    audible: { enabled: false, domain: 'com' },
    audnexus: { enabled: false },
    comicvine: { enabled: false, apiKey: '' },
    ranobedb: { enabled: false },
    kobo: { enabled: false, country: 'us', language: 'en' },
    lubimyczytac: { enabled: false },
    aladin: { enabled: false, ttbKey: '' },
    mangabaka: { enabled: false },
  } as ProviderConfigurations
}

function fullConfig(): ProviderConfigurations {
  return {
    ...configWithoutLibroFm(),
    librofm: { enabled: false },
  }
}

describe('ProviderConfigPanel', () => {
  it('does not render providers missing from the backend contract', async () => {
    const wrapper = mount(ProviderConfigPanel, {
      props: {
        config: configWithoutLibroFm(),
        statuses: [],
        saving: false,
      },
    })
    await nextTick()

    expect(wrapper.text()).not.toContain('Libro.fm')
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(14)
    wrapper.unmount()
  })

  it('renders Libro.fm when the backend includes its configuration section', async () => {
    const wrapper = mount(ProviderConfigPanel, {
      props: {
        config: fullConfig(),
        statuses: [],
        saving: false,
      },
    })
    await nextTick()

    expect(wrapper.text()).toContain('Libro.fm')
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(15)
    wrapper.unmount()
  })
})
