const KeyTermsTable = ({ keyDates = [], keyAmounts = [] }) => {
  const hasData = keyDates.length > 0 || keyAmounts.length > 0;
  if (!hasData) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
      <h2 className="text-slate-100 text-base sm:text-lg font-bold mb-4 sm:mb-6">
        Key Terms &amp; Important Information
      </h2>

      {/* Important Dates */}
      {keyDates.length > 0 && (
        <div className={keyAmounts.length > 0 ? 'mb-5 sm:mb-6' : ''}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Important Dates
          </h3>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full table-fixed border-collapse min-w-[280px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">
                    Label
                  </th>
                  <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">
                    Value
                  </th>
                </tr>
              </thead>

              <tbody>
                {keyDates.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-3 sm:px-4 py-3 text-sm text-slate-400 font-medium align-top break-words whitespace-normal leading-relaxed">
                      {item.label}
                    </td>

                    <td className="px-3 sm:px-4 py-3 text-sm text-slate-200 align-top break-words whitespace-normal leading-relaxed">
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Important Amounts */}
      {keyAmounts.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Important Amounts
          </h3>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full table-fixed border-collapse min-w-[280px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">
                    Label
                  </th>

                  <th className="text-left px-3 sm:px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">
                    Value
                  </th>
                </tr>
              </thead>

              <tbody>
                {keyAmounts.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-3 sm:px-4 py-3 text-sm text-slate-400 font-medium align-top break-words whitespace-normal leading-relaxed">
                      {item.label}
                    </td>

                    <td className="px-3 sm:px-4 py-3 text-sm text-amber-400 font-semibold align-top break-words whitespace-normal leading-relaxed">
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyTermsTable;