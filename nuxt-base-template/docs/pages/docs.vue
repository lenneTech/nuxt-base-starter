<script lang="ts" setup>
import type { RadioGroupItem } from '#ui/components/RadioGroup.vue';
import type { SelectItem } from '#ui/components/Select.vue';
import type { SelectMenuItem } from '#ui/components/SelectMenu.vue';
// ============================================================================
// Imports
// ============================================================================
import type { InferOutput } from 'valibot';

import { ModalBase } from '#components';
import * as v from 'valibot';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const colorMode = useColorMode();
const overlay = useOverlay();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  middleware: () => {
    const config = useRuntimeConfig();
    if (config.public.appEnv === 'production') {
      return navigateTo('/');
    }
  },
});

// ============================================================================
// Variables
// ============================================================================
// Button variants for showcase
const buttonVariants: Array<'ghost' | 'link' | 'outline' | 'soft' | 'solid'> = ['solid', 'outline', 'soft', 'ghost', 'link'];
const buttonColors: Array<'error' | 'info' | 'neutral' | 'primary' | 'secondary' | 'success' | 'warning'> = [
  'primary',
  'secondary',
  'success',
  'error',
  'warning',
  'info',
  'neutral',
];

// Form Schema and State
// Valibot validation schema - demonstrates various validation patterns
const formSchema = v.object({
  // Boolean with custom validation - checkbox must be checked (true)
  acceptTerms: v.pipe(
    v.boolean(),
    v.custom((value) => value === true, 'You must accept the terms and conditions'),
  ),
  // Number with range and type validation
  age: v.pipe(
    v.number('Age must be a number'),
    v.minValue(18, 'You must be at least 18 years old'),
    v.maxValue(120, 'Please enter a valid age'),
    v.integer('Age must be a whole number'),
  ),
  // Optional field with max length
  bio: v.optional(v.pipe(v.string(), v.maxLength(500, 'Bio must not exceed 500 characters'))),
  // Required string (select value)
  country: v.pipe(v.string(), v.minLength(1, 'Please select a country')),
  // Email validation
  email: v.pipe(v.string(), v.email('Please enter a valid email address')),
  // Optional file upload with custom validation (type and size)
  image: v.optional(
    v.custom<File>(
      (value) => value instanceof File && ['image/gif', 'image/jpeg', 'image/png'].includes(value.type) && value.size <= 2 * 1024 * 1024,
      'Please upload an image file (JPG, PNG, GIF) with max. 2MB',
    ),
  ),
  // Array validation - at least one item required
  interests: v.pipe(v.array(v.string()), v.minLength(1, 'Please select at least one interest')),
  // String with min and max length
  name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters'), v.maxLength(50, 'Name must not exceed 50 characters')),
  // Simple boolean without custom validation
  newsletter: v.boolean(),
  // Password with minimum length
  password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
  // Required radio group selection
  preferredContact: v.pipe(v.string(), v.minLength(1, 'Please select a preferred contact method')),
  // Number (slider) with minimum value
  salary: v.pipe(v.number(), v.minValue(0, 'Salary must be positive'), v.integer()),
});

type FormSchema = InferOutput<typeof formSchema>;

const formState = reactive<FormSchema>({
  acceptTerms: false,
  age: 25,
  bio: '',
  country: 'de',
  email: '',
  image: undefined,
  interests: [],
  name: '',
  newsletter: false,
  password: '',
  preferredContact: '',
  salary: 50000,
});

const countryOptions = ref<SelectItem[]>([
  {
    label: 'Germany',
    value: 'de',
  },
  {
    label: 'United Kingdom',
    value: 'en',
  },
  {
    label: 'Spain',
    value: 'es',
  },
  {
    label: 'Italy',
    value: 'it',
  },
]);

const interestOptions = ref<SelectMenuItem[]>([
  {
    label: 'Frontend Development',
    value: 'frontend',
  },
  {
    label: 'Backend Development',
    value: 'backend',
  },
  {
    label: 'DevOps',
    value: 'devops',
  },
  {
    label: 'UI/UX Design',
    value: 'design',
  },
  {
    label: 'Mobile Development',
    value: 'mobile',
  },
]);

const contactMethodOptions = ref<RadioGroupItem[]>([
  {
    description: 'Email as option.',
    label: 'Email',
    value: 'email',
  },
  {
    description: 'Phone as option.',
    label: 'Phone',
    value: 'phone',
  },
  {
    description: 'SMS as option.',
    label: 'SMS',
    value: 'sms',
  },
  {
    description: 'Pigeon as option.',
    label: 'Pigeon',
    value: 'pigeon',
  },
]);

// ============================================================================
// Functions
// ============================================================================
async function handleFormSubmit(): Promise<void> {
  toast.add({
    color: 'success',
    description: 'All form fields are valid! Check the browser console for the submitted data.',
    title: 'Form Submitted',
  });

  console.info('Form Data:', formState);
}

async function handleShare(): Promise<void> {
  const { share } = useLtShare();
  await share('Nuxt Base Starter', 'Check out this Nuxt Base Starter Template!', window.location.href);

  toast.add({
    color: 'success',
    description: 'Content shared successfully or copied to clipboard!',
    title: 'Shared',
  });
}

async function openModal(): Promise<void> {
  const modal = overlay.create(ModalBase);
  const instance = modal.open({
    description: 'This demonstrates the useOverlay composable for programmatic modal control.',
    title: 'Programmatic Modal',
  });

  const result = await instance.result;

  if (result) {
    toast.add({
      color: 'success',
      description: 'You confirmed the modal action.',
      title: 'Confirmed',
    });
  } else {
    toast.add({
      color: 'neutral',
      description: 'Modal was dismissed.',
      title: 'Dismissed',
    });
  }
}

function showToast(type: 'error' | 'info' | 'success' | 'warning'): void {
  const messages: Record<string, { description: string; title: string }> = {
    error: {
      description: 'Something went wrong.',
      title: 'Error',
    },
    info: {
      description: 'Here is some information.',
      title: 'Info',
    },
    success: {
      description: 'Your action was successful!',
      title: 'Success',
    },
    warning: {
      description: 'Please be careful.',
      title: 'Warning',
    },
  };

  toast.add({
    color: type,
    description: messages[type].description,
    title: messages[type].title,
  });
}

function toggleColorMode(): void {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}
</script>

<template>
  <div>
    <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <!-- Header -->
      <div class="mb-12">
        <div class="flex items-center justify-between mb-4">
          <div>
            <UBadge color="warning" variant="subtle" size="lg" class="mb-4"> Development Only </UBadge>
            <h1 class="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">Interactive Examples</h1>
            <p class="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
              This page is only available in development mode and showcases some interactive examples of the template.
            </p>
          </div>
          <UButton to="/" icon="i-lucide-arrow-left" variant="outline" color="neutral" size="lg"> Back to Home </UButton>
        </div>
      </div>

      <!-- Interactive Examples -->
      <div class="space-y-8">
        <UAlert
          title="Note"
          description="These examples demonstrate the most important UI components and composables of the template. Perfect for testing and as a reference for new projects."
          icon="i-lucide-lightbulb"
          color="primary"
          variant="subtle"
        />

        <!-- Button Showcase -->
        <UCard variant="outline">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Buttons</h3>
              <UButton to="https://ui.nuxt.com/components/button" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs"> Docs </UButton>
            </div>
          </template>

          <div class="space-y-6">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">Interactive buttons with multiple variants, sizes, and states. Essential for all user interactions.</p>

            <!-- Variants -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Variants</h4>
              <div class="flex flex-wrap gap-2">
                <UButton v-for="variant in buttonVariants" :key="variant" :variant="variant" color="primary"> {{ variant }} </UButton>
              </div>
            </div>

            <USeparator />

            <!-- Colors -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Colors (Solid Variant)</h4>
              <div class="flex flex-wrap gap-2">
                <UButton v-for="color in buttonColors" :key="color" :color="color"> {{ color }} </UButton>
              </div>
            </div>

            <USeparator />

            <!-- Sizes & Icons -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Sizes & Icons</h4>
              <div class="flex flex-wrap items-center gap-2">
                <UButton size="xs" icon="i-lucide-star"> Extra Small </UButton>
                <UButton size="sm" icon="i-lucide-star"> Small </UButton>
                <UButton size="md" icon="i-lucide-star"> Medium </UButton>
                <UButton size="lg" icon="i-lucide-star"> Large </UButton>
                <UButton size="xl" icon="i-lucide-star"> Extra Large </UButton>
              </div>
            </div>

            <USeparator />

            <!-- States -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">States</h4>
              <div class="flex flex-wrap gap-2">
                <UButton color="primary"> Normal </UButton>
                <UButton color="primary" loading> Loading </UButton>
                <UButton color="primary" disabled> Disabled </UButton>
                <UButton color="primary" icon="i-lucide-download" trailing-icon="i-lucide-arrow-right"> With Icons </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Interactive Components -->
        <UCard variant="outline">
          <template #header>
            <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Interactive Components</h3>
          </template>

          <div class="space-y-6">
            <!-- Toast Notifications -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-neutral-900 dark:text-white">Toast Notifications</h4>
                <UButton to="https://ui.nuxt.com/composables/use-toast" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                  Docs
                </UButton>
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Use <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useToast()</code> for notifications.
              </p>
              <div class="flex flex-wrap gap-2 mb-3">
                <UButton color="success" size="sm" @click="showToast('success')"> Success </UButton>
                <UButton color="error" size="sm" @click="showToast('error')"> Error </UButton>
                <UButton color="info" size="sm" @click="showToast('info')"> Info </UButton>
                <UButton color="warning" size="sm" @click="showToast('warning')"> Warning </UButton>
              </div>
            </div>

            <USeparator />

            <!-- Color Mode Toggle -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-neutral-900 dark:text-white">Color Mode</h4>
                <UButton to="https://ui.nuxt.com/getting-started/color-mode" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                  Docs
                </UButton>
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Use <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useColorMode()</code> for Dark/Light Mode.
              </p>
              <div class="flex items-center gap-4 mb-3">
                <UButton :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" color="neutral" variant="outline" size="sm" @click="toggleColorMode">
                  Toggle {{ colorMode.value === 'dark' ? 'Light' : 'Dark' }} Mode
                </UButton>
                <UBadge :color="colorMode.value === 'dark' ? 'primary' : 'warning'" size="md"> Current: {{ colorMode.value }} </UBadge>
              </div>
            </div>

            <USeparator />

            <!-- Badges -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-neutral-900 dark:text-white">Badges & Variants</h4>
                <UButton to="https://ui.nuxt.com/components/badge" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs"> Docs </UButton>
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Various badge variants and colors for different purposes.</p>
              <div class="flex flex-wrap gap-2 mb-3">
                <UBadge color="primary" variant="solid"> Primary </UBadge>
                <UBadge color="secondary" variant="solid"> Secondary </UBadge>
                <UBadge color="success" variant="outline"> Success </UBadge>
                <UBadge color="error" variant="soft"> Error </UBadge>
                <UBadge color="info" variant="subtle" icon="i-lucide-info"> Info </UBadge>
              </div>
            </div>

            <USeparator />

            <!-- Modal -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-neutral-900 dark:text-white">Programmatic Modal</h4>
                <UButton
                  to="https://ui.nuxt.com/docs/components/modal#programmatic-usage"
                  target="_blank"
                  trailing-icon="i-lucide-external-link"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                >
                  Docs
                </UButton>
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Use the <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useOverlay()</code> composable to open modals programmatically and await the
                result.
              </p>
              <UButton icon="i-lucide-square-dashed-mouse-pointer" color="primary" size="sm" variant="outline" class="mb-3" @click="openModal"> Open Modal </UButton>
            </div>
          </div>
        </UCard>

        <!-- Form Example with Valibot -->
        <UCard variant="outline">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Form Validation with Valibot</h3>
              <UButton to="https://ui.nuxt.com/components/form" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs"> Docs </UButton>
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              This form demonstrates all important Nuxt UI input components with Valibot validation. Fill in all required fields and observe the real-time validation.
            </p>

            <UForm :state="formState" :schema="formSchema" class="space-y-6" @submit="handleFormSubmit">
              <!-- Basic Text Inputs -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  Text Inputs
                  <UButton to="https://ui.nuxt.com/components/input" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                    Docs
                  </UButton>
                </h4>
                <div class="grid md:grid-cols-2 gap-4">
                  <UFormField label="Full Name" name="name" required>
                    <UInput v-model="formState.name" placeholder="Enter your full name" icon="i-lucide-user" />
                  </UFormField>

                  <UFormField label="Email Address" name="email" required>
                    <UInput v-model="formState.email" type="email" placeholder="your.email@example.com" icon="i-lucide-mail" />
                  </UFormField>

                  <UFormField label="Password" name="password" required help="At least 8 characters">
                    <UInput v-model="formState.password" type="password" placeholder="Enter a secure password" icon="i-lucide-lock" />
                  </UFormField>

                  <UFormField label="Age" name="age" required help="You must be at least 18 years old">
                    <UInput v-model.number="formState.age" type="number" placeholder="Enter your age" icon="i-lucide-calendar" />
                  </UFormField>
                </div>
              </div>

              <USeparator />

              <!-- Textarea -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  Textarea
                  <UButton to="https://ui.nuxt.com/components/textarea" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                    Docs
                  </UButton>
                </h4>
                <UFormField label="Bio" name="bio" help="Optional - maximum 500 characters">
                  <UTextarea v-model="formState.bio" placeholder="Tell us about yourself..." :rows="4" />
                </UFormField>
              </div>

              <USeparator />

              <!-- Selection Components -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white">Selection Components</h4>
                <div class="grid md:grid-cols-2 gap-4">
                  <UFormField label="Country" name="country" required>
                    <template #help>
                      <span class="flex items-center gap-1">
                        Select
                        <UButton to="https://ui.nuxt.com/components/select" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                          Docs
                        </UButton>
                      </span>
                    </template>
                    <USelect v-model="formState.country" :items="countryOptions" placeholder="Select your country" />
                  </UFormField>

                  <UFormField label="Areas of Interest" name="interests" required>
                    <template #help>
                      <span class="flex items-center gap-1">
                        Select Menu
                        <UButton to="https://ui.nuxt.com/components/select-menu" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                          Docs
                        </UButton>
                      </span>
                    </template>
                    <USelectMenu v-model="formState.interests" :items="interestOptions" value-key="value" multiple placeholder="Select your interests" />
                  </UFormField>
                </div>
              </div>

              <USeparator />

              <!-- Slider & Toggles -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white">Slider & Toggles</h4>
                <div class="grid md:grid-cols-2 gap-4">
                  <UFormField label="Expected Salary (USD)" name="salary" :help="`$${formState.salary.toLocaleString()} per year`">
                    <template #label>
                      <span class="flex items-center gap-1">
                        Expected Salary (USD)
                        <UButton to="https://ui.nuxt.com/components/slider" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                          Docs
                        </UButton>
                      </span>
                    </template>
                    <USlider v-model="formState.salary" :min="0" :max="200000" :step="1000" />
                  </UFormField>

                  <UFormField label="Newsletter Subscription" name="newsletter" help="Receive updates about new features">
                    <template #label>
                      <span class="flex items-center gap-1">
                        Newsletter Subscription
                        <UButton to="https://ui.nuxt.com/components/switch" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                          Docs
                        </UButton>
                      </span>
                    </template>
                    <USwitch v-model="formState.newsletter" />
                  </UFormField>
                </div>
              </div>

              <USeparator />

              <!-- Radio Group -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  Radio Group
                  <UButton to="https://ui.nuxt.com/components/radio-group" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                    Docs
                  </UButton>
                </h4>
                <UFormField label="Preferred Contact Method" name="preferredContact" required>
                  <URadioGroup v-model="formState.preferredContact" :items="contactMethodOptions" />
                </UFormField>
              </div>

              <USeparator />

              <!-- File Upload -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  File Upload
                  <UButton to="https://ui.nuxt.com/components/file-upload" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                    Docs
                  </UButton>
                </h4>
                <UFormField name="image" label="Image" description="JPG, GIF or PNG. 2MB Max.">
                  <UFileUpload v-model="formState.image" accept="image/*" class="min-h-48" />
                </UFormField>
              </div>

              <USeparator />

              <!-- Checkbox -->
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  Checkbox
                  <UButton to="https://ui.nuxt.com/components/checkbox" target="_blank" trailing-icon="i-lucide-external-link" variant="ghost" color="neutral" size="xs">
                    Docs
                  </UButton>
                </h4>
                <UFormField name="acceptTerms" required>
                  <UCheckbox v-model="formState.acceptTerms" label="I accept the terms and conditions" />
                </UFormField>
              </div>

              <USeparator />

              <!-- Submit Button -->
              <div class="flex items-center gap-3 pt-4">
                <UButton type="submit" color="primary" size="lg" icon="i-lucide-send"> Submit Form </UButton>
                <p class="text-xs text-neutral-500">All data will be logged to the console</p>
              </div>
            </UForm>
          </div>
        </UCard>

        <!-- Custom Composables -->
        <UCard variant="outline">
          <template #header>
            <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Template Composables</h3>
          </template>

          <div class="space-y-6">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">This template includes custom composables for common tasks. These are auto-imported and ready to use.</p>

            <!-- useShare -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-neutral-900 dark:text-white">useShare</h4>
                <UBadge color="primary" variant="subtle"> Auto-imported </UBadge>
              </div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Share content using the Web Share API with automatic fallback.</p>
              <UButton size="sm" icon="i-lucide-share-2" class="mb-3" @click="handleShare"> Share Content </UButton>
            </div>
          </div>
        </UCard>

        <!-- Documentation Links -->
        <UCard variant="outline">
          <template #header>
            <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Additional Resources</h3>
          </template>

          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <h4 class="font-medium text-neutral-900 dark:text-white">Nuxt UI Documentation</h4>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">All available components and their props</p>
              </div>
              <UButton to="https://ui.nuxt.com" target="_blank" trailing-icon="i-lucide-external-link" variant="outline" color="neutral" size="sm"> Docs </UButton>
            </div>

            <div class="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <h4 class="font-medium text-neutral-900 dark:text-white">GitHub Repository</h4>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Source code and additional examples</p>
              </div>
              <UButton to="https://github.com/lenneTech/nuxt-base-starter" target="_blank" trailing-icon="i-lucide-external-link" variant="outline" color="neutral" size="sm">
                GitHub
              </UButton>
            </div>

            <div class="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <h4 class="font-medium text-neutral-900 dark:text-white">CLAUDE.md</h4>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Detailed project documentation</p>
              </div>
              <UBadge color="primary" variant="subtle"> Included in project </UBadge>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
