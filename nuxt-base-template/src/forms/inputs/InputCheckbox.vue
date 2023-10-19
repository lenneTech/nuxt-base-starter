<script setup lang="ts">
const props = defineProps({
  context: Object,
});
const name = props.context.name;
const label = props.context.attrs.text;

function setInput(e) {
  props.context.node.input(e.target.checked);
}
</script>

<template>
  <div :class="context.classes.container">
    <label :id="props.context?.id" :class="context.classes.wrapper">
      <div :class="context.classes.inner">
        <input :class="context.classes.input" type="checkbox" :name="name" @input="setInput" />
        <span :class="context.classes.decorator" aria-hidden="true">
          <span :class="[context.classes.decoratorIcon, context.classes.icon]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 27">
              <polygon fill="currentColor" points="26.99 0 10.13 17.17 4.69 11.63 0 16.41 10.4 27 15.05 22.27 15.09 22.31 32 5.1 26.99 0" />
            </svg>
          </span>
        </span>
      </div>
    </label>
    <span :class="context.classes.label" v-html="label"></span>
  </div>
</template>