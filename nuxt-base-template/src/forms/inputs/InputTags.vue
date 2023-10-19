<script setup lang="ts">
interface TagOption {
  label: string;
  value: string;
}

const props = defineProps({
  context: Object,
});

const inputRef = ref();
const inputValue = ref<string>();
const inputFocus = ref();
const name = props.context?.name;
const placeholder = props.context?.attrs?.placeholder;
const tags = ref<TagOption[]>([]);
const defaultOptions: TagOption[] = [...props?.context?.attrs?.options] || [];
const selectOptions = ref<TagOption[]>([...props?.context?.attrs?.options]);
patch();

function patch() {
  const values = props.context?._value;
  if (!values) {
    return;
  }

  if (Array.isArray(values)) {
    for (let item of values) {
      handleSelect(item);
    }
  } else {
    handleSelect(values);
  }
}

function handleSelect(value: string) {
  const tag = selectOptions.value.find((e) => e.value === value);
  const included = tags.value?.find((e) => e.value === tag?.value) ?? false;

  if (!tag) {
    return;
  }

  if (!included) {
    tags.value.push(tag);
    selectOptions.value = defaultOptions.filter((e) => e.value !== tag.value);
  }

  props.context?.node.input(tags.value.map((e) => e.value));
  inputValue.value = '';
}

function handleInput(event: any) {
  const value = event.target.value.toLowerCase();

  if (!value) {
    selectOptions.value = defaultOptions.filter((e: TagOption) => !props.context?._value?.includes(e.value));
  } else {
    selectOptions.value = selectOptions.value.filter((e: TagOption) => e.label.toLowerCase().includes(value));
  }
}

function removeTag(tag: TagOption) {
  tags.value.splice(tags.value.findIndex((e) => e.value === tag.value), 1);
  props.context?.node.input(tags.value.map((e) => e.value));
  selectOptions.value = defaultOptions.filter((e: TagOption) => !props.context?._value?.includes(e.value));
}

function setFocus() {
  inputFocus.value = true;
  inputValue.value = '';
  selectOptions.value = defaultOptions.filter((e: TagOption) => !props.context?._value?.includes(e.value));
}
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-row flex-wrap gap-2">
      <span v-for="tag of tags" :key="tag.value" :class="context?.classes.tag">{{ tag.label }} <span class="i-bi-x" :class="context?.classes.tagIcon" @click="removeTag(tag)"></span> </span>
    </div>
    <div v-if="selectOptions.length" class="relative" :class="context?.classes.inputWrapper">
      <div class="relative w-full flex items-center">
        <input
          :id="props.context?.id"
          ref="inputRef"
          v-model="inputValue"
          autocomplete="off"
          :name="name" type="text" :placeholder="placeholder" :class="context?.classes.input" @focus="setFocus"
          @blur="inputFocus = false" @input="handleInput"
        />
        <span :class="context?.classes.selectIcon" class="formkit-select-icon flex p-[3px] shrink-0 w-5 mr-2 -ml-[1.5em] h-full pointer-events-none formkit-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 7"><path d="M8,6.5c-.13,0-.26-.05-.35-.15L3.15,1.85c-.2-.2-.2-.51,0-.71,.2-.2,.51-.2,.71,0l4.15,4.15L12.15,1.15c.2-.2,.51-.2,.71,0,.2,.2,.2,.51,0,.71l-4.5,4.5c-.1,.1-.23,.15-.35,.15Z" fill="currentColor" /></svg></span>
      </div>
      <TransitionFade :start-duration="200" :leave-duration="200">
        <div
          v-show="inputFocus && defaultOptions.length"
          class="absolute right-0 left-0 z-50 h-fit max-h-12 flex flex-col justify-start items-start"
          :style="`top: ${inputRef?.clientHeight + 1}px`"
          :class="context?.classes.dropdown"
        >
          <div v-if="selectOptions.length" class="w-full">
            <button v-for="option of selectOptions" :key="option.value" :class="context?.classes.dropdownItem" @click="handleSelect(option.value)">
              {{ option.label }}
            </button>
          </div>
          <div v-else :class="context?.classes.noItemsFound">
            Keine Einträge gefunden
          </div>
        </div>
      </TransitionFade>
    </div>
  </div>
</template>