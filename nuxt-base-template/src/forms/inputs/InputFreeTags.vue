<script setup lang="ts">
const props = defineProps({
  context: Object,
});

const inputRef = ref();
const inputValue = ref<string>();
const name = props.context?.name;
const placeholder = props.context?.attrs?.placeholder;
const defaultSuggestions = [...props.context?.attrs?.suggestions] || [];
const suggestions = ref<string[]>([...props.context?.attrs?.suggestions]);
const tags = ref<string[]>([]);
patch();

function patch() {
  const values = props.context?._value;
  if (values && Array.isArray(values)) {
    for (let item of values) {
      addTag(item);
    }
  }
}


function addTag(tag?: string) {
  if (!inputValue.value && !tag) {
    return;
  }

  if (tag) {
    tags.value.push(tag);
    // remove tag from suggestions
    if (suggestions.value.findIndex((e) => e === tag) >= 0) {
      suggestions.value.splice(suggestions.value.findIndex((e) => e === tag), 1);
    }
  } else {
    if (!tags.value.includes(inputValue.value as string)) {
      tags.value.push(inputValue.value as string);
    }

    if (suggestions.value.includes(inputValue.value as string)) {
      if (suggestions.value.findIndex((e) => e === tag) >= 0) {
        suggestions.value.splice(suggestions.value.findIndex((e) => e === inputValue.value), 1);
      }
    }

    inputValue.value = '';
  }

  props.context?.node.input(tags.value);
}

function removeTag(tag: string) {
  tags.value.splice(tags.value.findIndex((e) => e === tag), 1);

  if (defaultSuggestions.includes(tag) && !suggestions.value.includes(tag)) {
    suggestions.value.push(tag);
  }

  props.context?.node.input(tags.value);
}
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-row flex-wrap gap-2">
      <span v-for="(tag, index) of tags" :key="index" :class="context?.classes.tag">{{ tag }} <span class="i-bi-x" :class="context?.classes.tagIcon" @click="removeTag(tag)"></span> </span>
    </div>
    <div :class="context?.classes.inputWrapper">
      <input
        :id="props.context?.id"
        ref="inputRef"
        v-model="inputValue"
        :name="name"
        type="text"
        :placeholder="placeholder"
        :class="context?.classes.input"
        @keydown.enter.prevent="addTag()"
      />
      <span :class="context?.classes.inputIcon"></span>
    </div>
    <div>
      <button type="button" :disabled="!inputValue" :class="context?.classes.button" @click="addTag()">
        {{ context?.attrs.buttonText ?? context?.attrs['button-text'] }}
      </button>
    </div>
    <div v-if="suggestions?.length" :class="context?.classes.suggestionsWrapper">
      <p :class="context?.classes.suggestionsHeadline">
        Beliebte Skills
      </p>
      <div class="flex flex-row flex-wrap gap-2">
        <div v-for="(tag, index) of suggestions" :key="index" :class="context?.classes.suggestionsTag">
          {{ tag }} <span :class="context?.classes.suggestionsIcon" @click="addTag(tag)"></span>
        </div>
      </div>
    </div>
  </div>
</template>