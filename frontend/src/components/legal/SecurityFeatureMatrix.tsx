type MatrixRow = {
  topic: string;
  explanation: string;
};

const rows: MatrixRow[] = [
  {
    topic: 'Data encryption',
    explanation:
      'Browser and API traffic uses HTTPS. Stored workspace content is protected using industry-standard encryption appropriate to our hosting environment.',
  },
  {
    topic: 'Access control',
    explanation:
      'Access is scoped to organizations and workspaces. We recommend least-privilege roles, a small set of organization admins, and periodic access reviews as your team changes.',
  },
  {
    topic: 'Connected integrations',
    explanation:
      'Advertising and collaboration connectors use authorization flows (for example OAuth-style grants) where applicable. Customers should connect only accounts they are permitted to manage.',
  },
  {
    topic: 'Logging and monitoring',
    explanation:
      'We use operational logging for reliability, diagnostics, and security monitoring. We avoid collecting more personal data than needed to run and improve the service.',
  },
  {
    topic: 'Availability and backups',
    explanation:
      'We maintain backup and recovery practices to support resilience. Specific recovery objectives may vary by deployment and should be confirmed during enterprise review if required.',
  },
];

export default function SecurityFeatureMatrix() {
  return (
    <div className="mt-8 max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[min(100%,36rem)] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th scope="col" className="px-5 py-4 text-sm font-semibold text-gray-900 lg:px-6 lg:py-5">
                Control area
              </th>
              <th scope="col" className="px-5 py-4 text-sm font-semibold text-gray-900 lg:px-6 lg:py-5">
                Summary
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.topic} className={index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                <th
                  scope="row"
                  className="align-top px-5 py-4 text-sm font-semibold text-gray-900 lg:px-6 lg:py-5"
                >
                  {row.topic}
                </th>
                <td className="align-top px-5 py-4 text-sm leading-6 text-gray-600 lg:px-6 lg:py-5">
                  {row.explanation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
