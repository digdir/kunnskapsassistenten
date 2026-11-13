import { Tag } from '@digdir/designsystemet-react';
import { useEffect, useState } from 'react';
import { fetchTestEnvironment } from '../../api/session';
import { TEST_ENVIRONMENT_TAG } from './text';

type TestEnvironmentTagProps = {
  /** Overrides the fetch: an environment, or null for none. Only for tests. */
  environment?: string | null;
};

/** «Testmiljø» for a tester, whose questions the BFF sends to genki's test environment (#237). */
export function TestEnvironmentTag({ environment: given }: TestEnvironmentTagProps) {
  const [environment, setEnvironment] = useState<string | undefined>(given ?? undefined);

  useEffect(() => {
    if (given !== undefined) return;
    const abort = new AbortController();
    void fetchTestEnvironment(abort.signal).then((found) => {
      if (!abort.signal.aborted) setEnvironment(found);
    });
    return () => abort.abort();
  }, [given]);

  if (!environment) return null;

  return (
    <Tag className="ka-test-environment" data-color="warning" data-size="sm">
      {TEST_ENVIRONMENT_TAG}
    </Tag>
  );
}
