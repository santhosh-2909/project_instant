import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Meter,
  Skeleton,
  SortableTh,
  Stat,
  Table,
  TableEmpty,
  TableWrap,
  Tabs,
  VerdictBadge,
  verdictTone,
} from '@/components/ui';

describe('TC-UI-01 Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Verify claim</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Verify claim' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies the requested variant and size classes', () => {
    const { container } = render(
      <Button variant="danger" size="lg">
        Delete
      </Button>
    );
    expect(container.firstElementChild?.className).toContain('btnDanger');
    expect(container.firstElementChild?.className).toContain('btnLg');
  });

  it('blocks interaction and announces busy state while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    // A disabled button cannot receive pointer events at all, so dispatching
    // one directly is the honest way to prove the handler stays unreached.
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes an accessible loading label', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards a ref to the underlying element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('TC-UI-02 Badge and verdict mapping', () => {
  it('maps each verdict to a distinct tone', () => {
    expect(verdictTone('Real')).toBe('real');
    expect(verdictTone('Fake')).toBe('fake');
    expect(verdictTone('Uncertain')).toBe('uncertain');
  });

  it('treats an unrecognised verdict as uncertain rather than crashing', () => {
    expect(verdictTone('Nonsense')).toBe('uncertain');
  });

  it('renders a verdict badge with its label', () => {
    render(<VerdictBadge verdict="Fake" />);
    expect(screen.getByText('Fake')).toBeInTheDocument();
  });

  it('applies the tone class', () => {
    const { container } = render(<Badge tone="real">Verified</Badge>);
    expect(container.firstElementChild?.className).toContain('badgeReal');
  });
});

describe('TC-UI-03 Field, Input and accessibility wiring', () => {
  it('associates the label with the control', () => {
    render(<Field label="Email address">{(props) => <Input {...props} />}</Field>);
    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
  });

  it('links the hint via aria-describedby', () => {
    render(
      <Field label="Password" hint="At least 8 characters.">
        {(props) => <Input {...props} />}
      </Field>
    );
    const input = screen.getByLabelText(/Password/);
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('At least 8 characters.');
  });

  it('marks the control invalid and announces the error', () => {
    render(
      <Field label="Mobile" error="Enter exactly 10 digits.">
        {(props) => <Input {...props} />}
      </Field>
    );
    expect(screen.getByLabelText(/Mobile/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter exactly 10 digits.');
  });

  it('prefers the error over the hint when both are present', () => {
    render(
      <Field label="Mobile" hint="10 digits." error="Invalid.">
        {(props) => <Input {...props} />}
      </Field>
    );
    expect(screen.queryByText('10 digits.')).toBeNull();
    expect(screen.getByText('Invalid.')).toBeInTheDocument();
  });

  it('generates a unique id per field instance', () => {
    render(
      <>
        <Field label="First">{(props) => <Input {...props} />}</Field>
        <Field label="Second">{(props) => <Input {...props} />}</Field>
      </>
    );
    const first = screen.getByLabelText('First');
    const second = screen.getByLabelText('Second');
    expect(first.id).not.toBe(second.id);
  });
});

describe('TC-UI-04 Meter', () => {
  it('exposes meter semantics with the correct value', () => {
    render(<Meter label="Match with claim" value={73} />);
    const meter = screen.getByRole('meter', { name: 'Match with claim' });
    expect(meter).toHaveAttribute('aria-valuenow', '73');
  });

  it('clamps values outside 0..100', () => {
    render(
      <>
        <Meter label="Over" value={480} />
        <Meter label="Under" value={-20} />
      </>
    );
    expect(screen.getByRole('meter', { name: 'Over' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('meter', { name: 'Under' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('treats a non-finite value as zero instead of rendering NaN', () => {
    render(<Meter label="Broken" value={Number.NaN} />);
    expect(screen.getByRole('meter', { name: 'Broken' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('applies the verdict tone class when given one', () => {
    const { container } = render(<Meter label="Confidence" value={80} tone="Fake" />);
    expect(container.querySelector('.meterFill')?.className).toContain('meterFillFake');
  });
});

describe('TC-UI-05 Tabs', () => {
  it('exposes tablist semantics and the selected tab', () => {
    render(
      <Tabs
        label="Report sections"
        tabs={[
          { id: 'a', label: 'Evidence' },
          { id: 'b', label: 'Reasoning' },
        ]}
        active="a"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('tablist', { name: 'Report sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Reasoning' })).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps only the active tab in the tab order (roving tabindex)', () => {
    render(
      <Tabs
        label="Sections"
        tabs={[
          { id: 'a', label: 'One' },
          { id: 'b', label: 'Two' },
        ]}
        active="a"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1');
  });

  it('reports the selected id on change', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Sections"
        tabs={[
          { id: 'a', label: 'One' },
          { id: 'b', label: 'Two' },
        ]}
        active="a"
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('TC-UI-06 Alert', () => {
  it('uses assertive live region semantics for errors', () => {
    render(<Alert tone="error">Something failed</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses polite status semantics for non-errors', () => {
    render(<Alert tone="success">Saved</Alert>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders a dismiss control only when a handler is supplied', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Alert tone="info">Message</Alert>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();

    rerender(
      <Alert tone="info" onDismiss={onDismiss}>
        Message
      </Alert>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('TC-UI-07 Table primitives', () => {
  it('marks the active sort column with aria-sort', async () => {
    const onSort = vi.fn();
    render(
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <SortableTh label="Claim" sortKey="title" activeKey="title" dir="asc" onSort={onSort} />
              <SortableTh label="Confidence" sortKey="conf" activeKey="title" dir="asc" onSort={onSort} numeric />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>row</td>
              <td>90%</td>
            </tr>
          </tbody>
        </Table>
      </TableWrap>
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('aria-sort', 'ascending');
    expect(headers[1]).toHaveAttribute('aria-sort', 'none');

    await userEvent.click(within(headers[1]).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith('conf');
  });

  it('renders an empty state spanning the full row', () => {
    render(
      <Table>
        <tbody>
          <TableEmpty colSpan={4}>No records found.</TableEmpty>
        </tbody>
      </Table>
    );
    const cell = screen.getByRole('cell');
    expect(cell).toHaveAttribute('colspan', '4');
    expect(cell).toHaveTextContent('No records found.');
  });
});

describe('TC-UI-08 Card, Stat, Skeleton, EmptyState', () => {
  it('renders card header, body and action', () => {
    render(
      <Card>
        <CardHeader title="Verification history" description="12 records" action={<Button size="sm">New</Button>} />
        <CardBody>Body content</CardBody>
      </Card>
    );
    expect(screen.getByText('Verification history')).toBeInTheDocument();
    expect(screen.getByText('12 records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders a card as a semantic element when asked', () => {
    const { container } = render(<Card as="article">content</Card>);
    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('shows a skeleton instead of a value while a stat is loading', () => {
    const { rerender, container } = render(<Stat label="Checks" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();

    rerender(<Stat label="Checks" value={42} loading />);
    expect(screen.queryByText('42')).toBeNull();
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('hides decorative skeletons from assistive technology', () => {
    const { container } = render(<Skeleton height={20} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders an empty state with an action', () => {
    render(<EmptyState title="Nothing yet" description="Verify a claim to begin." action={<Button>Start</Button>} />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});
