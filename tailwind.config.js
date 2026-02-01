/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{vue,js,ts,jsx,tsx,html}',
        './src/popup/**/*.{vue,js,ts,jsx,tsx}',
        './src/options/**/*.{vue,js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d',
                },
                sage: {
                    50: '#f8faf9',
                    100: '#f1f5f2',
                    200: '#e2eae4',
                    300: '#c8d7cc',
                    400: '#a8bfad',
                    500: '#8ba490',
                    600: '#718777',
                    700: '#5d6f62',
                    800: '#4c5a50',
                    900: '#404a44',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}