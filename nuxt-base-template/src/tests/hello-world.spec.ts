import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import HelloWorld from '../components/hello-world.vue';

describe('HelloWorld', () => {
  it('is a Vue instance', () => {
    const wrapper = mount(HelloWorld);
    expect(wrapper.vm).toBeTruthy();
  });
});
