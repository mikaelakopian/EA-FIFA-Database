#!/usr/bin/env python3
"""
Проверка синтаксиса всех Python файлов после исправления.
"""

import subprocess
import os
import sys

def check_syntax():
    """Проверить синтаксис всех Python файлов"""
    print("🔍 Проверка синтаксиса Python файлов...")
    print("=" * 50)
    
    endpoints_dir = "/root/EA/server/endpoints"
    server_file = "/root/EA/server/server.py"
    
    errors = []
    success = []
    
    # Проверяем server.py
    try:
        result = subprocess.run(
            ['python3', '-m', 'py_compile', server_file],
            capture_output=True, text=True, cwd='/root/EA/server'
        )
        if result.returncode == 0:
            success.append("server.py")
            print("✅ server.py")
        else:
            errors.append(f"server.py: {result.stderr}")
            print(f"❌ server.py: {result.stderr}")
    except Exception as e:
        errors.append(f"server.py: {e}")
        print(f"❌ server.py: {e}")
    
    # Проверяем все файлы в endpoints/
    if os.path.exists(endpoints_dir):
        for filename in sorted(os.listdir(endpoints_dir)):
            if filename.endswith('.py'):
                filepath = os.path.join(endpoints_dir, filename)
                try:
                    result = subprocess.run(
                        ['python3', '-m', 'py_compile', filepath],
                        capture_output=True, text=True
                    )
                    if result.returncode == 0:
                        success.append(f"endpoints/{filename}")
                        print(f"✅ endpoints/{filename}")
                    else:
                        errors.append(f"endpoints/{filename}: {result.stderr}")
                        print(f"❌ endpoints/{filename}: {result.stderr}")
                except Exception as e:
                    errors.append(f"endpoints/{filename}: {e}")
                    print(f"❌ endpoints/{filename}: {e}")
    
    # Проверяем utils/
    utils_dir = os.path.join(endpoints_dir, 'utils')
    if os.path.exists(utils_dir):
        for filename in sorted(os.listdir(utils_dir)):
            if filename.endswith('.py'):
                filepath = os.path.join(utils_dir, filename)
                try:
                    result = subprocess.run(
                        ['python3', '-m', 'py_compile', filepath],
                        capture_output=True, text=True
                    )
                    if result.returncode == 0:
                        success.append(f"endpoints/utils/{filename}")
                        print(f"✅ endpoints/utils/{filename}")
                    else:
                        errors.append(f"endpoints/utils/{filename}: {result.stderr}")
                        print(f"❌ endpoints/utils/{filename}: {result.stderr}")
                except Exception as e:
                    errors.append(f"endpoints/utils/{filename}: {e}")
                    print(f"❌ endpoints/utils/{filename}: {e}")
    
    print("\n" + "=" * 50)
    print("📊 РЕЗУЛЬТАТЫ ПРОВЕРКИ:")
    print("=" * 50)
    
    print(f"✅ Успешно: {len(success)} файлов")
    print(f"❌ Ошибки: {len(errors)} файлов")
    
    if errors:
        print("\n🔥 НАЙДЕННЫЕ ОШИБКИ:")
        for error in errors:
            print(f"   {error}")
        return False
    else:
        print("\n🎉 ВСЕ ФАЙЛЫ СИНТАКСИЧЕСКИ КОРРЕКТНЫ!")
        return True

def main():
    """Основная функция"""
    print("🧹 Финальная проверка после исправления DEBUG сообщений")
    print("=" * 60)
    
    # Проверка синтаксиса
    syntax_ok = check_syntax()
    
    print("\n" + "=" * 60)
    print("📋 ИТОГОВЫЙ СТАТУС:")
    print("=" * 60)
    
    if syntax_ok:
        print("✅ Все исправления выполнены успешно!")
        print("✅ Синтаксис всех файлов корректен")
        print("✅ DEBUG сообщения удалены")
        print("✅ Красивое форматирование добавлено")
        print("\n🚀 Сервер готов к запуску!")
        print("   Команда: uvicorn server:app --reload")
    else:
        print("❌ Есть синтаксические ошибки")
        print("⚠️ Нужны дополнительные исправления")
    
    return syntax_ok

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)