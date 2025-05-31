import os

def combine_mdx_to_txt(root_folder, output_txt_file):
    """
    Traverses the root_folder, finds all .mdx files, concatenates their content,
    and saves it to output_txt_file.
    """
    concatenated_content = []
    file_count = 0
    files_processed = []

    print(f"Начинаем сканирование папки: {root_folder}")
    for subdir, _, files in os.walk(root_folder):
        for filename in files:
            if filename.lower().endswith(".mdx"): # case-insensitive check for .mdx
                filepath = os.path.join(subdir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        print(f"Чтение файла: {filepath}")
                        concatenated_content.append(f.read())
                        # Добавляем разделитель и имя исходного файла для ясности
                        concatenated_content.append(f"\n\n--- Содержимое из файла: {filename} (путь: {filepath}) ---\n\n")
                        files_processed.append(filepath)
                        file_count += 1
                except Exception as e:
                    print(f"Ошибка при чтении файла {filepath}: {e}")

    if not concatenated_content:
        print("Файлы .mdx не найдены или произошла ошибка при чтении.")
        return

    try:
        with open(output_txt_file, 'w', encoding='utf-8') as outfile:
            outfile.write("".join(concatenated_content))
        print(f"\nУспешно объединено {file_count} .mdx файлов в: {output_txt_file}")
        if files_processed:
            print("\nОбработанные файлы:")
            for fp in files_processed:
                print(f"- {fp}")
    except Exception as e:
        print(f"Ошибка при записи в выходной файл {output_txt_file}: {e}")

if __name__ == "__main__":
    # Папка, содержащая .mdx файлы (и ее подпапки)
    documentation_root_dir = r"c:\Users\mikae\Desktop\Проекты\EA\documentation"
    
    # Имя выходного .txt файла
    output_file_name = "combined_documentation.txt"
    
    # Путь к выходному файлу .txt
    # Он будет сохранен в родительской директории 'documentation'
    # т.е. c:\Users\mikae\Desktop\Проекты\EA\combined_documentation.txt
    output_file_path = os.path.join(os.path.abspath(os.path.join(documentation_root_dir, os.pardir)), output_file_name)
    
    print("Этот скрипт объединит все .mdx файлы, найденные в указанной директории")
    print(f"и ее поддиректориях, в один .txt файл: {output_file_path}")
    print("\nВажно: Сейчас слово 'переведет' интерпретируется как простое объединение (конкатенация) исходного содержимого файлов .mdx.")
    print("Если вам необходимо удалить синтаксис MDX/JSX (чтобы получить чистый текст) или выполнить языковой перевод,")
    print("пожалуйста, сообщите, так как скрипт потребует доработки.\n")
    
    combine_mdx_to_txt(documentation_root_dir, output_file_path)
