import ast
import os
import sys

def check_file(filepath):
    issues = []
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        issues.append(f"SyntaxError: {e}")
        return issues
        
    class Visitor(ast.NodeVisitor):
        def __init__(self):
            self.defined_names = set()
            self.duplicates = []
            
        def visit_FunctionDef(self, node):
            if node.name in self.defined_names:
                self.duplicates.append(f"Duplicate function: {node.name} at line {node.lineno}")
            self.defined_names.add(node.name)
            self.generic_visit(node)
            
        def visit_ClassDef(self, node):
            if node.name in self.defined_names:
                self.duplicates.append(f"Duplicate class: {node.name} at line {node.lineno}")
            self.defined_names.add(node.name)
            self.generic_visit(node)
            
        def visit_AsyncFunctionDef(self, node):
            if node.name in self.defined_names:
                self.duplicates.append(f"Duplicate async function: {node.name} at line {node.lineno}")
            self.defined_names.add(node.name)
            self.generic_visit(node)

    visitor = Visitor()
    visitor.visit(tree)
    if visitor.duplicates:
        issues.extend(visitor.duplicates)
        
    return issues

def main():
    root_dir = "app"
    all_issues = {}
    for dirpath, _, filenames in os.walk(root_dir):
        for file in filenames:
            if file.endswith('.py'):
                path = os.path.join(dirpath, file)
                issues = check_file(path)
                if issues:
                    all_issues[path] = issues
    
    if all_issues:
        for path, issues in all_issues.items():
            print(f"--- {path} ---")
            for issue in issues:
                print(f"  {issue}")
        sys.exit(1)
    else:
        print("No syntax or duplicate definition issues found.")
        sys.exit(0)

if __name__ == '__main__':
    main()
