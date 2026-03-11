# Text Autocomplete

Utilize text autocomplete to type more efficiently.

## Features

- A dropdown of suggested words of the currently typed word
- Replace the currently typed word with a suggestion from the dropdown by:
  - Selecting a suggestion with your cursor
  - Selecting the highlighted suggestion with the `enter`/`tab` keys 
- Navigate dropdown suggestions with the `up/down arrow` keys
- Hide the dropdown with the `esc` key at which point all keys have their default functionalities
- To use the default `enter` key functionality, additionally hold the `shift` key: `shift + enter`

### Custom dictionary

The custom dictionary is a list of words you curate that is added to the plugin's dictionary. The words from the custom dictionary can then be suggested in future dropdowns. You can view all words in the custom dictionary from the plugin settings.

#### Modification

- Words can be individually added to the custom dictionary in the following two ways:
  - From the plugin settings
  - In the context menu of selected text (accessible via `right click`)
- Words can be individually removed from the custom dictionary only from within the plugin settings
- The custom dictionary can be reset in the plugin settings

### Imported dictionaries

In addition to the custom dictionary, dictionaries can be imported. Imported dictionaries can be added/removed in the plugin settings and must be Text Files (`.txt`) with one word on each line. You can view all imported dictionaries from the plugin settings.

## Additional

- The maximum number of suggestions is modifiable in the plugin settings (3-10)
- The plugin can be disabled from the plugin settings
- English is the only supported language at the moment
- For the time being, all features are disabled within code blocks (typing within code blocks is not supported)

#### Thanks to everyone using the plugin!