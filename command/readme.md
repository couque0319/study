# 터미널 명령어 구현

## 명령어 코드 

### 1. ls 명령어
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>

int main() {
    DIR *dir = opendir(".");
    if (dir == NULL) {
        perror("opendir");
        return 1;
    }

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        // 숨김 파일 제외
        if (entry->d_name[0] == '.')
            continue;

        // 파일 이름 출력
        printf("%s  ", entry->d_name);
    }

    printf("\n");

    closedir(dir);
    return 0;
}

```

---

### 2. ls -h (-h 옵션)
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <sys/stat.h>
#include <string.h>
#include <unistd.h>

// 사람이 읽기 쉬운 크기로 변환
void human_readable_size(off_t size, char *buf, size_t buf_size) {
    const char *units[] = {"B", "K", "M", "G", "T"};
    int unit_index = 0;
    double readable_size = (double)size;

    while (readable_size >= 1024 && unit_index < 4) {
        readable_size /= 1024.0;
        unit_index++;
    }

    snprintf(buf, buf_size, "%.1f%s", readable_size, units[unit_index]);
}

int main(int argc, char *argv[]) {
    int human = 0;
    int opt;

    // -h 옵션 파싱
    while ((opt = getopt(argc, argv, "h")) != -1) {
        if (opt == 'h') {
            human = 1;
        } else {
            fprintf(stderr, "Usage: %s [-h]\n", argv[0]);
            exit(EXIT_FAILURE);
        }
    }

    DIR *dir = opendir(".");
    if (!dir) {
        perror("opendir");
        return 1;
    }

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        // 숨김 파일 제외
        if (entry->d_name[0] == '.')
            continue;

        if (human) {
            struct stat st;
            // 파일 상태 정보 조회
            if (stat(entry->d_name, &st) == -1) {
                perror("stat");
                continue;
            }

            char sizebuf[16];
            human_readable_size(st.st_size, sizebuf, sizeof(sizebuf));
            // 파일명과 사람이 읽기 쉬운 크기 출력
            printf("%-20s %6s\n", entry->d_name, sizebuf);
        } else {
            // 파일명만 출력
            printf("%s  ", entry->d_name);
        }
    }

    if (!human)
        printf("\n");

    closedir(dir);
    return 0;
}

```

---

###  3. ls -t 
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <sys/stat.h>
#include <string.h>
#include <unistd.h>

#define MAX_FILES 1024

typedef struct {
    char name[256];     // 파일 이름
    time_t mtime;       // 수정 시간
} FileInfo;

// 수정 시간 기준으로 내림차순 정렬 (최신 파일이 먼저)
int compare_mtime(const void *a, const void *b) {
    FileInfo *fa = (FileInfo *)a;
    FileInfo *fb = (FileInfo *)b;
    return (fb->mtime - fa->mtime);
}

int main(int argc, char *argv[]) {
    int sort_by_time = 0;
    int opt;

    // -t 옵션 파싱
    while ((opt = getopt(argc, argv, "t")) != -1) {
        if (opt == 't') {
            sort_by_time = 1;
        } else {
            fprintf(stderr, "Usage: %s [-t]\n", argv[0]);
            exit(EXIT_FAILURE);
        }
    }

    DIR *dir = opendir(".");
    if (!dir) {
        perror("opendir");
        return 1;
    }

    struct dirent *entry;
    FileInfo files[MAX_FILES];
    int count = 0;

    // 디렉토리 내부 항목 읽기
    while ((entry = readdir(dir)) != NULL) {
        // 숨김 파일 제외
        if (entry->d_name[0] == '.')
            continue;

        if (count >= MAX_FILES) {
            fprintf(stderr, "Too many files\n");
            break;
        }

        struct stat st;
        // 파일의 상태 정보(stat)를 가져와서 수정 시간 저장
        if (stat(entry->d_name, &st) == -1) {
            perror("stat");
            continue;
        }

        strncpy(files[count].name, entry->d_name, sizeof(files[count].name));
        files[count].mtime = st.st_mtime;
        count++;
    }

    closedir(dir);

    // -t 옵션이 있을 경우 수정 시간 기준 정렬 수행
    if (sort_by_time) {
        qsort(files, count, sizeof(FileInfo), compare_mtime);
    }

    // 정렬된 파일 목록 출력
    for (int i = 0; i < count; i++) {
        printf("%s  ", files[i].name);
    }

    printf("\n");
    return 0;
}

```

---

###  4. ls -r
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <string.h>
#include <unistd.h>

#define MAX_FILES 1024

int compare_name(const void *a, const void *b) {
    const char *fa = *(const char **)a;
    const char *fb = *(const char **)b;
    return strcmp(fa, fb);  // 이름 오름차순 정렬
}

int main(int argc, char *argv[]) {
    int reverse = 0;
    int opt;

    // -r 옵션 파싱
    while ((opt = getopt(argc, argv, "r")) != -1) {
        if (opt == 'r') {
            reverse = 1;
        } else {
            fprintf(stderr, "Usage: %s [-r]\n", argv[0]);
            exit(EXIT_FAILURE);
        }
    }

    DIR *dir = opendir(".");
    if (!dir) {
        perror("opendir");
        return 1;
    }

    struct dirent *entry;
    char *filenames[MAX_FILES];
    int count = 0;

    // 파일 이름을 배열에 저장
    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_name[0] == '.')
            continue;

        if (count >= MAX_FILES) {
            fprintf(stderr, "Too many files\n");
            break;
        }

        filenames[count] = strdup(entry->d_name);  // 복사해서 저장
        count++;
    }

    closedir(dir);

    // 이름 기준 정렬
    qsort(filenames, count, sizeof(char *), compare_name);

    // 출력
    if (reverse) {
        // 뒤에서부터 출력
        for (int i = count - 1; i >= 0; i--) {
            printf("%s  ", filenames[i]);
            free(filenames[i]);  // 메모리 해제
        }
    } else {
        for (int i = 0; i < count; i++) {
            printf("%s  ", filenames[i]);
            free(filenames[i]);  // 메모리 해제
        }
    }

    printf("\n");
    return 0;
}

```

---

###  5. ls -al
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <sys/stat.h>
#include <pwd.h>
#include <grp.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

// 파일 권한 출력 (예: -rw-r--r--)
void print_permissions(mode_t mode) {
    char perms[11] = "----------";
    if (S_ISDIR(mode)) perms[0] = 'd';
    if (S_ISLNK(mode)) perms[0] = 'l';
    if (mode & S_IRUSR) perms[1] = 'r';
    if (mode & S_IWUSR) perms[2] = 'w';
    if (mode & S_IXUSR) perms[3] = 'x';
    if (mode & S_IRGRP) perms[4] = 'r';
    if (mode & S_IWGRP) perms[5] = 'w';
    if (mode & S_IXGRP) perms[6] = 'x';
    if (mode & S_IROTH) perms[7] = 'r';
    if (mode & S_IWOTH) perms[8] = 'w';
    if (mode & S_IXOTH) perms[9] = 'x';
    printf("%s ", perms);
}

// 상세 정보 출력
void print_file_info(const char *filename) {
    struct stat st;
    if (stat(filename, &st) == -1) {
        perror("stat");
        return;
    }

    print_permissions(st.st_mode);                      // 파일 권한 출력
    printf("%2ld ", st.st_nlink);                       // 하드링크 수

    struct passwd *pw = getpwuid(st.st_uid);            // 사용자 이름
    struct group *gr = getgrgid(st.st_gid);             // 그룹 이름
    printf("%s %s ", pw ? pw->pw_name : "?", gr ? gr->gr_name : "?");

    printf("%6ld ", st.st_size);                        // 파일 크기

    char timebuf[80];
    struct tm *timeinfo = localtime(&st.st_mtime);      // 수정 시간
    strftime(timebuf, sizeof(timebuf), "%b %d %H:%M", timeinfo);
    printf("%s ", timebuf);

    printf("%s\n", filename);                           // 파일 이름
}

int main(int argc, char *argv[]) {
    int show_all = 0;
    int long_format = 0;
    int opt;

    // 옵션 파싱
    while ((opt = getopt(argc, argv, "al")) != -1) {
        if (opt == 'a') show_all = 1;
        else if (opt == 'l') long_format = 1;
        else {
            fprintf(stderr, "Usage: %s [-a] [-l]\n", argv[0]);
            exit(EXIT_FAILURE);
        }
    }

    DIR *dir = opendir(".");
    if (!dir) {
        perror("opendir");
        return 1;
    }

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        // 숨김 파일 제외 조건
        if (!show_all && entry->d_name[0] == '.')
            continue;

        if (long_format)
            print_file_info(entry->d_name);  // 상세 출력
        else
            printf("%s  ", entry->d_name);   // 이름만 출력
    }

    if (!long_format)
        printf("\n");

    closedir(dir);
    return 0;
}

```

---

###  6. basename
```
#include <stdio.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc < 2 || argc > 3) {
        fprintf(stderr, "Usage: %s path [suffix]\n", argv[0]);
        return 1;
    }

    char *path = argv[1];
    char *filename = strrchr(path, '/');

    if (filename)
        filename++; // '/' 다음부터 시작
    else
        filename = path;

    if (argc == 3) {
        char *suffix = argv[2];
        size_t len_filename = strlen(filename);
        size_t len_suffix = strlen(suffix);

        if (len_filename > len_suffix &&
            strcmp(filename + len_filename - len_suffix, suffix) == 0) {
            filename[len_filename - len_suffix] = '\0'; // 확장자 제거
        }
    }

    printf("%s\n", filename);
    return 0;
}

```

---

###  7. dirname
```
#include <stdio.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s path\n", argv[0]);
        return 1;
    }

    char *path = argv[1];
    static char temp[1024];
    strncpy(temp, path, sizeof(temp));
    temp[sizeof(temp) - 1] = '\0';

    char *last_slash = strrchr(temp, '/');

    if (!last_slash) {
        // 슬래시가 없는 경우, 현재 디렉토리
        printf(".\n");
    } else if (last_slash == temp) {
        // 루트 디렉토리인 경우
        *(last_slash + 1) = '\0';
        printf("%s\n", temp);
    } else {
        // 그 외 일반적인 경우
        *last_slash = '\0';
        printf("%s\n", temp);
    }

    return 0;
}

```

---

###  8. wc - c
```
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    int count_bytes = 0;
    int opt;

    // -c 옵션 파싱
    while ((opt = getopt(argc, argv, "c")) != -1) {
        if (opt != 'c') {
            fprintf(stderr, "Usage: %s -c filename\n", argv[0]);
            return 1;
        }
        count_bytes = 1;
    }

    if (optind >= argc) {
        fprintf(stderr, "Missing filename\n");
        return 1;
    }

    FILE *fp = fopen(argv[optind], "rb");  // 바이너리 모드로 열기 (정확한 바이트 계산)
    if (!fp) {
        perror("fopen");
        return 1;
    }

    long byte_count = 0;
    int ch;

    // 한 바이트씩 읽으며 개수 세기
    while ((ch = fgetc(fp)) != EOF) {
        byte_count++;
    }

    fclose(fp);

    // 출력
    printf("%ld %s\n", byte_count, argv[optind]);
    return 0;
}

```

---

###  9.wc -w
```
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <ctype.h>

int main(int argc, char *argv[]) {
    int count_words = 0;
    int opt;

    // -w 옵션 파싱
    while ((opt = getopt(argc, argv, "w")) != -1) {
        if (opt != 'w') {
            fprintf(stderr, "Usage: %s -w filename\n", argv[0]);
            return 1;
        }
        count_words = 1;
    }

    if (optind >= argc) {
        fprintf(stderr, "Missing filename\n");
        return 1;
    }

    FILE *fp = fopen(argv[optind], "r");
    if (!fp) {
        perror("fopen");
        return 1;
    }

    int ch;
    int in_word = 0;
    long word_count = 0;

    // 한 글자씩 읽으며 단어 개수 세기
    while ((ch = fgetc(fp)) != EOF) {
        if (isspace(ch)) {
            in_word = 0;  // 공백이면 단어 끝
        } else {
            if (!in_word) {
                word_count++;  // 새 단어 시작
                in_word = 1;
            }
        }
    }

    fclose(fp);

    // 출력
    printf("%ld %s\n", word_count, argv[optind]);
    return 0;
}

```

---

###  10. tee -a
```
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    if (argc != 3 || strcmp(argv[1], "-a") != 0) {
        fprintf(stderr, "Usage: %s -a filename\n", argv[0]);
        return 1;
    }

    FILE *fp = fopen(argv[2], "a");  // append 모드로 열기
    if (!fp) {
        perror("fopen");
        return 1;
    }

    char buffer[1024];

    // 표준 입력을 한 줄씩 읽어서
    while (fgets(buffer, sizeof(buffer), stdin)) {
        fputs(buffer, stdout);  // 화면에 출력
        fputs(buffer, fp);      // 파일에 쓰기 (이어쓰기)
    }

    fclose(fp);
    return 0;
}

```

---

###  11. tee -i
```
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>
#include <string.h>

void handle_sigint(int sig) {
    // 무시 처리
}

int main(int argc, char *argv[]) {
    if (argc != 3 || strcmp(argv[1], "-i") != 0) {
        fprintf(stderr, "Usage: %s -i filename\n", argv[0]);
        return 1;
    }

    signal(SIGINT, handle_sigint);  // Ctrl+C 무시

    FILE *fp = fopen(argv[2], "w");  // 새로 쓰기 모드
    if (!fp) {
        perror("fopen");
        return 1;
    }

    char buffer[1024];

    while (fgets(buffer, sizeof(buffer), stdin)) {
        fputs(buffer, stdout);  // 화면 출력
        fputs(buffer, fp);      // 파일 출력
    }

    fclose(fp);
    return 0;
}

```

---

###  12.
```

```

---

###  13.
```

```

---

###  14.
```

```

---

###  15.
```

```

---

###  16.
```

```

---

###  17.
```

```

---

###  18.
```

```

---

###  19.
```

```

---

###  20.
```

```

---

###  21.
```

```

---

###  22.
```

```

---

###  23.
```

```

---

###  24.
```

```

---

###  25.
```

```

---

###  26.
```

```

---

###  27.
```

```

---

###  28.
```

```

---

###  29.
```

```

---

###  30.
```

```

---

###  31.
```

```

---

###  32.
```

```

---

###  33.
```

```

---

###  34.
```

```

---

###  35.
```

```

---

###  36.
```

```

---

###  37.
```

```

---

###  38.
```

```

---

###  39.
```

```

---

###  40.
```

```

---

###  41.
```

```

---

###  42.
```

```

---

###  43.
```

```

---

###  44.
```

```

---

###  45.
```

```

---

###  46.
```

```

---

###  47.
```

```

---

###  48.
```

```

---

###  49.
```

```

---

###  50.
```

```

---


