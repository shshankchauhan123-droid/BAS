filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\routes\AppRoutes.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import_statement = 'import FinancialTransactionIntelligenceReport from "../pages/user/reports/FinancialTransactionIntelligenceReport";\n'
text = text.replace('import CounterpartyIntelligenceReport', import_statement + 'import CounterpartyIntelligenceReport')

route_statement = '''
        <Route
          path="/dashboard/cases/:caseId/reports/financial-transaction-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "admin", "superadmin", "client_admin"]}>
                <FinancialTransactionIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/financial-transaction-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "admin", "superadmin", "client_admin"]}>
                <FinancialTransactionIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
'''

text = text.replace('</Routes>', route_statement + '      </Routes>')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
