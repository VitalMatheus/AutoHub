import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlatformConfirmation } from './platform-primitives';

describe('PlatformConfirmation', () => {
  it('focuses the first action, traps Tab, and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const triggerRef = { current: trigger };
    const { unmount } = render(<PlatformConfirmation title="Confirmar ação" description="Confirma?" triggerRef={triggerRef} onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
