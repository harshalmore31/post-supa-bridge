import { useColorMode } from '@nuxtjs/color-mode';

export const useColorModeExtended = () => {
  const colorMode = useColorMode();

  const toggleColorMode = () => {
    if (colorMode.preference === 'dark') {
      colorMode.preference = 'light';
    } else {
      colorMode.preference = 'dark';
    }
  };

  return {
    colorModePreference: colorMode.preference, // Expose preference (e.g., 'light', 'dark', 'system')
    colorModeValue: colorMode.value, // Expose the resolved value (e.g., 'light' or 'dark')
    toggleColorMode,
  };
};
