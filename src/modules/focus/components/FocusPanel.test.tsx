import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {FocusPanel} from './FocusPanel';

describe('FocusPanel', () => {
  it('renders running task title and stops through callback', () => {
    const onStop = vi.fn();

    render(
      <FocusPanel
        styleContext={{primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'}}
        runningSession={{
          id: 1,
          taskId: 2,
          userId: 1,
          startedAt: '',
          status: 'RUNNING',
          createdAt: '',
          taskTitle: '写周报',
        }}
        focusTimeElapsed={3661}
        formattedElapsed="01:01:01"
        progressOffset={320}
        handleStopSession={onStop}
        handlePauseSession={vi.fn()}
        handleResumeSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/写周报/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /停止并记录专注时长/i}));

    expect(onStop).toHaveBeenCalledOnce();
  });

  it('shows pause for running sessions and resume for paused sessions', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const baseSession = {
      id: 1,
      taskId: 2,
      userId: 1,
      startedAt: '',
      createdAt: '',
      taskTitle: '写周报',
    };

    const {rerender} = render(
      <FocusPanel
        styleContext={{primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'}}
        runningSession={{...baseSession, status: 'RUNNING'}}
        focusTimeElapsed={60}
        formattedElapsed="00:01:00"
        progressOffset={600}
        handleStopSession={vi.fn()}
        handlePauseSession={onPause}
        handleResumeSession={onResume}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: /暂停专注/i}));
    expect(onPause).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', {name: /继续专注/i})).not.toBeInTheDocument();

    rerender(
      <FocusPanel
        styleContext={{primary: '#fb7185', primaryLight: '#fff1f2', secondary: '#fda4af'}}
        runningSession={{...baseSession, status: 'PAUSED', pausedAt: '2026-06-05T01:10:00.000Z'}}
        focusTimeElapsed={60}
        formattedElapsed="00:01:00"
        progressOffset={600}
        handleStopSession={vi.fn()}
        handlePauseSession={onPause}
        handleResumeSession={onResume}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: /继续专注/i}));
    expect(onResume).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', {name: /暂停专注/i})).not.toBeInTheDocument();
  });
});
