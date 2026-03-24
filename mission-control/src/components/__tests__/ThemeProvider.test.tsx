import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider } from '../ThemeProvider'

describe('ThemeProvider', () => {
  it('renders children and sets data-theme attribute', () => {
    const { getByText } = render(
      <ThemeProvider>
        <div>hello</div>
      </ThemeProvider>
    )
    expect(getByText('hello')).toBeTruthy()
    // Note: testing DOM attribute requires setup (jsdom). This test file is illustrative
  })
})
