import importlib
import pkgutil
import sys

def import_submodules(package_name):
    package = sys.modules[package_name]
    results = []
    
    if not hasattr(package, '__path__'):
        return results

    for loader, name, is_pkg in pkgutil.walk_packages(package.__path__, package.__name__ + '.'):
        try:
            importlib.import_module(name)
        except Exception as e:
            results.append((name, str(e)))
            
    return results

if __name__ == '__main__':
    import app
    errors = import_submodules('app')
    if errors:
        for name, err in errors:
            print(f"FAILED: {name} - {err}")
        sys.exit(1)
    else:
        print("All modules imported successfully.")
        sys.exit(0)
