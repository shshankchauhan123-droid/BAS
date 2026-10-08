filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\frontend\src\routes\AppRoutes.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import_stmt = 'import CounterpartyIntelligenceReport from "../pages/user/reports/CounterpartyIntelligenceReport";\n'
text = import_stmt + text

route_code = '''
        <Route
          path="/dashboard/cases/:caseId/reports/counterparty-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "admin", "superadmin", "client_admin"]}>
                <CounterpartyIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/counterparty-intelligence"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["user", "admin", "superadmin", "client_admin"]}>
                <CounterpartyIntelligenceReport />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
'''

text = text.replace('      </Routes>', route_code + '      </Routes>')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated AppRoutes.jsx")
