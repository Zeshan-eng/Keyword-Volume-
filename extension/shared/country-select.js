/** Populates a <select> with the supported countries (shared by popup and options). */
import { COUNTRIES } from './countries.js';

export function populateCountrySelect(select, selectedCode) {
  select.replaceChildren(
    ...COUNTRIES.map(({ code, name }) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      option.selected = code === selectedCode;
      return option;
    }),
  );
}
