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

###  12. head -n
```
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    int lines = 10;  // 기본값: 10줄
    int opt;

    // -n 옵션 파싱
    while ((opt = getopt(argc, argv, "n:")) != -1) {
        if (opt == 'n') {
            lines = atoi(optarg);  // 문자열을 정수로
        } else {
            fprintf(stderr, "Usage: %s [-n number] filename\n", argv[0]);
            return 1;
        }
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

    char buffer[1024];
    int count = 0;

    while (fgets(buffer, sizeof(buffer), fp)) {
        printf("%s", buffer);
        if (++count >= lines)
            break;
    }

    fclose(fp);
    return 0;
}

```

---

###  13. tail -n
```
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>

#define MAX_LINES 10000

int main(int argc, char *argv[]) {
    int lines = 10;  // 기본값
    int opt;

    // -n 옵션 파싱
    while ((opt = getopt(argc, argv, "n:")) != -1) {
        if (opt == 'n') {
            lines = atoi(optarg);
        } else {
            fprintf(stderr, "Usage: %s [-n number] filename\n", argv[0]);
            return 1;
        }
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

    // 최대 MAX_LINES 줄까지 저장할 수 있는 버퍼
    char *linebuf[MAX_LINES];
    int count = 0;

    char buffer[1024];
    while (fgets(buffer, sizeof(buffer), fp)) {
        // 기존 메모리 해제 (재사용)
        if (count >= MAX_LINES) {
            free(linebuf[count % MAX_LINES]);
        }

        linebuf[count % MAX_LINES] = strdup(buffer);  // 줄 복사 저장
        count++;
    }

    fclose(fp);

    int start = (count > lines) ? (count - lines) : 0;

    for (int i = start; i < count; i++) {
        printf("%s", linebuf[i % MAX_LINES]);
        free(linebuf[i % MAX_LINES]);  // 메모리 해제
    }

    return 0;
}

```

---

###  14. kill
```
// 파일명: kill_default.c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <PID>\n", argv[0]);
        return 1;
    }

    pid_t pid = atoi(argv[1]);

    // SIGTERM (기본 시그널: 종료 요청)
    if (kill(pid, SIGTERM) == -1) {
        perror("kill");
        return 1;
    }

    printf("Sent SIGTERM to PID %d\n", pid);
    return 0;
}

```

---

###  15. kill -singal pid
```
// 파일명: kill_with_signal.c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    int sig = SIGTERM; // 기본값

    // 옵션 파싱: -9 또는 -15 같은 형태
    if (argc == 3 && argv[1][0] == '-') {
        sig = atoi(argv[1] + 1);  // '-9' → 9
        pid_t pid = atoi(argv[2]);

        if (kill(pid, sig) == -1) {
            perror("kill");
            return 1;
        }

        printf("Sent signal %d to PID %d\n", sig, pid);
        return 0;
    }

    fprintf(stderr, "Usage: %s -<signal> <PID>\n", argv[0]);
    fprintf(stderr, "Example: %s -9 1234\n", argv[0]);
    return 1;
}

```

---

###  16. ps
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <string.h>
#include <ctype.h>

void show_processes() {
    DIR *proc = opendir("/proc");
    if (!proc) {
        perror("opendir");
        exit(1);
    }

    struct dirent *entry;

    printf("%-10s %s\n", "PID", "CMD");

    while ((entry = readdir(proc)) != NULL) {
        // PID인지 확인 (숫자인 디렉토리만)
        if (!isdigit(entry->d_name[0]))
            continue;

        char cmd_path[256];
        snprintf(cmd_path, sizeof(cmd_path), "/proc/%s/cmdline", entry->d_name);

        FILE *fp = fopen(cmd_path, "r");
        if (!fp) continue;

        char cmd[256];
        fgets(cmd, sizeof(cmd), fp);
        fclose(fp);

        if (strlen(cmd) == 0)
            strcpy(cmd, "-");  // 명령어가 없는 경우 표시

        printf("%-10s %s\n", entry->d_name, cmd);
    }

    closedir(proc);
}

int main() {
    show_processes();
    return 0;
}

```

---

###  17. ps -e
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <string.h>
#include <ctype.h>

void show_all_processes() {
    DIR *proc = opendir("/proc");
    if (!proc) {
        perror("opendir");
        exit(1);
    }

    struct dirent *entry;

    printf("%-10s %s\n", "PID", "CMD");

    while ((entry = readdir(proc)) != NULL) {
        if (!isdigit(entry->d_name[0]))
            continue;

        char cmd_path[256];
        snprintf(cmd_path, sizeof(cmd_path), "/proc/%s/cmdline", entry->d_name);

        FILE *fp = fopen(cmd_path, "r");
        if (!fp) continue;

        char cmd[256];
        if (fgets(cmd, sizeof(cmd), fp) == NULL || strlen(cmd) == 0) {
            strcpy(cmd, "-");  // 명령어가 없을 경우
        }

        fclose(fp);

        printf("%-10s %s\n", entry->d_name, cmd);
    }

    closedir(proc);
}

int main() {
    show_all_processes();
    return 0;
}

```

---

###  18. ps -f
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <string.h>
#include <ctype.h>
#include <unistd.h>
#include <pwd.h>

void show_full_processes() {
    DIR *proc = opendir("/proc");
    if (!proc) {
        perror("opendir");
        exit(1);
    }

    struct dirent *entry;

    printf("%-10s %-6s %-6s %s\n", "UID", "PID", "PPID", "CMD");

    while ((entry = readdir(proc)) != NULL) {
        if (!isdigit(entry->d_name[0]))
            continue;

        char path[256];
        char status_path[256], cmdline_path[256];
        snprintf(status_path, sizeof(status_path), "/proc/%s/status", entry->d_name);
        snprintf(cmdline_path, sizeof(cmdline_path), "/proc/%s/cmdline", entry->d_name);

        FILE *status_fp = fopen(status_path, "r");
        FILE *cmd_fp = fopen(cmdline_path, "r");
        if (!status_fp || !cmd_fp) {
            if (status_fp) fclose(status_fp);
            if (cmd_fp) fclose(cmd_fp);
            continue;
        }

        char line[256];
        int uid = -1, pid = -1, ppid = -1;
        while (fgets(line, sizeof(line), status_fp)) {
            if (strncmp(line, "Uid:", 4) == 0) {
                sscanf(line, "Uid:\t%d", &uid);
            } else if (strncmp(line, "Pid:", 4) == 0) {
                sscanf(line, "Pid:\t%d", &pid);
            } else if (strncmp(line, "PPid:", 5) == 0) {
                sscanf(line, "PPid:\t%d", &ppid);
            }
        }

        char *username = "?";
        struct passwd *pw = getpwuid(uid);
        if (pw) username = pw->pw_name;

        char cmdline[256];
        if (fgets(cmdline, sizeof(cmdline), cmd_fp) == NULL) {
            strcpy(cmdline, "-");
        }

        printf("%-10s %-6d %-6d %s\n", username, pid, ppid, cmdline);

        fclose(status_fp);
        fclose(cmd_fp);
    }

    closedir(proc);
}

int main() {
    show_full_processes();
    return 0;
}

```

---

###  19. ps -u
```
#include <stdio.h>
#include <stdlib.h>
#include <dirent.h>
#include <string.h>
#include <ctype.h>
#include <unistd.h>
#include <sys/types.h>

void show_user_processes() {
    uid_t current_uid = getuid();  // 현재 사용자 UID

    DIR *proc = opendir("/proc");
    if (!proc) {
        perror("opendir");
        exit(1);
    }

    struct dirent *entry;

    printf("%-10s %s\n", "PID", "CMD");

    while ((entry = readdir(proc)) != NULL) {
        if (!isdigit(entry->d_name[0]))
            continue;

        char status_path[256];
        snprintf(status_path, sizeof(status_path), "/proc/%s/status", entry->d_name);

        FILE *status_fp = fopen(status_path, "r");
        if (!status_fp) continue;

        int uid = -1;
        char line[256];

        while (fgets(line, sizeof(line), status_fp)) {
            if (strncmp(line, "Uid:", 4) == 0) {
                sscanf(line, "Uid:\t%d", &uid);
                break;
            }
        }

        fclose(status_fp);

        if (uid != current_uid)
            continue;

        char cmd_path[256], cmd[256];
        snprintf(cmd_path, sizeof(cmd_path), "/proc/%s/cmdline", entry->d_name);
        FILE *cmd_fp = fopen(cmd_path, "r");
        if (!cmd_fp) continue;

        if (fgets(cmd, sizeof(cmd), cmd_fp) == NULL || strlen(cmd) == 0) {
            strcpy(cmd, "-");
        }

        fclose(cmd_fp);

        printf("%-10s %s\n", entry->d_name, cmd);
    }

    closedir(proc);
}

int main() {
    show_user_processes();
    return 0;
}

```

---

###  20. ps -o
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <dirent.h>
#include <unistd.h>
#include <pwd.h>

int show_pid = 0, show_ppid = 0, show_cmd = 0, show_uid = 0;

void parse_format(const char *fmt) {
    char fmt_copy[128];
    strncpy(fmt_copy, fmt, sizeof(fmt_copy));
    fmt_copy[sizeof(fmt_copy) - 1] = '\0';

    char *token = strtok(fmt_copy, ",");
    while (token) {
        if (strcmp(token, "pid") == 0) show_pid = 1;
        else if (strcmp(token, "ppid") == 0) show_ppid = 1;
        else if (strcmp(token, "cmd") == 0) show_cmd = 1;
        else if (strcmp(token, "uid") == 0) show_uid = 1;
        token = strtok(NULL, ",");
    }
}

void print_header() {
    if (show_uid) printf("%-10s ", "UID");
    if (show_pid) printf("%-6s ", "PID");
    if (show_ppid) printf("%-6s ", "PPID");
    if (show_cmd) printf("%s", "CMD");
    printf("\n");
}

void show_selected_fields() {
    DIR *proc = opendir("/proc");
    if (!proc) {
        perror("opendir");
        exit(1);
    }

    struct dirent *entry;

    print_header();

    while ((entry = readdir(proc)) != NULL) {
        if (!isdigit(entry->d_name[0])) continue;

        char status_path[256], cmdline_path[256];
        snprintf(status_path, sizeof(status_path), "/proc/%s/status", entry->d_name);
        snprintf(cmdline_path, sizeof(cmdline_path), "/proc/%s/cmdline", entry->d_name);

        FILE *status_fp = fopen(status_path, "r");
        if (!status_fp) continue;

        int uid = -1, pid = -1, ppid = -1;
        char line[256];
        while (fgets(line, sizeof(line), status_fp)) {
            if (strncmp(line, "Uid:", 4) == 0)
                sscanf(line, "Uid:\t%d", &uid);
            else if (strncmp(line, "Pid:", 4) == 0)
                sscanf(line, "Pid:\t%d", &pid);
            else if (strncmp(line, "PPid:", 5) == 0)
                sscanf(line, "PPid:\t%d", &ppid);
        }
        fclose(status_fp);

        char cmd[256] = "-";
        FILE *cmd_fp = fopen(cmdline_path, "r");
        if (cmd_fp) {
            if (fgets(cmd, sizeof(cmd), cmd_fp) == NULL || strlen(cmd) == 0) {
                strcpy(cmd, "-");
            }
            fclose(cmd_fp);
        }

        if (show_uid) printf("%-10d ", uid);
        if (show_pid) printf("%-6d ", pid);
        if (show_ppid) printf("%-6d ", ppid);
        if (show_cmd) printf("%s", cmd);
        printf("\n");
    }

    closedir(proc);
}

int main(int argc, char *argv[]) {
    if (argc != 3 || strcmp(argv[1], "-o") != 0) {
        fprintf(stderr, "Usage: %s -o [pid,ppid,cmd,uid]\n", argv[0]);
        return 1;
    }

    parse_format(argv[2]);
    show_selected_fields();

    return 0;
}

```

---

###  21. ps -x
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <dirent.h>

void show_processes_with_or_without_tty() {
    DIR *proc = opendir("/proc");
    if (!proc) {
        perror("opendir");
        exit(1);
    }

    struct dirent *entry;

    printf("%-6s %-6s %s\n", "PID", "TTY", "CMD");

    while ((entry = readdir(proc)) != NULL) {
        if (!isdigit(entry->d_name[0]))
            continue;

        char stat_path[256];
        snprintf(stat_path, sizeof(stat_path), "/proc/%s/stat", entry->d_name);

        FILE *stat_fp = fopen(stat_path, "r");
        if (!stat_fp) continue;

        int pid, tty_nr;
        char comm[256], state;
        // 필요한 앞부분 필드만 파싱
        fscanf(stat_fp, "%d %s %c", &pid, comm, &state);
        for (int i = 0; i < 3; i++) fscanf(stat_fp, "%*s"); // skip ppid, pgrp, session
        fscanf(stat_fp, "%d", &tty_nr);  // tty_nr
        fclose(stat_fp);

        char tty_str[16];
        if (tty_nr == 0)
            strcpy(tty_str, "?");  // TTY 없는 프로세스
        else
            strcpy(tty_str, "tty");  // 간단히 표시

        // cmdline 가져오기
        char cmd_path[256], cmd[256] = "-";
        snprintf(cmd_path, sizeof(cmd_path), "/proc/%s/cmdline", entry->d_name);
        FILE *cmd_fp = fopen(cmd_path, "r");
        if (cmd_fp) {
            if (fgets(cmd, sizeof(cmd), cmd_fp) == NULL || strlen(cmd) == 0)
                strcpy(cmd, "-");
            fclose(cmd_fp);
        }

        printf("%-6d %-6s %s\n", pid, tty_str, cmd);
    }

    closedir(proc);
}

int main() {
    show_processes_with_or_without_tty();
    return 0;
}

```

---

###  22. df -hT
```
#include <stdio.h>
#include <stdlib.h>
#include <sys/statvfs.h>
#include <mntent.h>
#include <string.h>

void human_readable(unsigned long long size, char *out) {
    const char *units[] = {"B", "K", "M", "G", "T"};
    int i = 0;
    double s = (double)size;

    while (s >= 1024 && i < 4) {
        s /= 1024;
        i++;
    }

    sprintf(out, "%.1f%s", s, units[i]);
}

int main() {
    FILE *mnt = setmntent("/etc/mtab", "r");
    if (!mnt) {
        perror("setmntent");
        return 1;
    }

    struct mntent *ent;

    printf("%-20s %-10s %-10s %-10s %-10s %s\n", 
           "Filesystem", "Type", "Size", "Used", "Avail", "Mounted on");

    while ((ent = getmntent(mnt)) != NULL) {
        struct statvfs vfs;

        // 파일시스템 사용량 정보 수집
        if (statvfs(ent->mnt_dir, &vfs) != 0)
            continue;

        unsigned long long total = vfs.f_blocks * vfs.f_frsize;
        unsigned long long avail = vfs.f_bavail * vfs.f_frsize;
        unsigned long long used = total - avail;

        char total_str[16], used_str[16], avail_str[16];
        human_readable(total, total_str);
        human_readable(used, used_str);
        human_readable(avail, avail_str);

        // 최종 출력
        printf("%-20s %-10s %-10s %-10s %-10s %s\n", 
               ent->mnt_fsname, ent->mnt_type, total_str, used_str, avail_str, ent->mnt_dir);
    }

    endmntent(mnt);
    return 0;
}

```

---

###  23. df -i
```
#include <stdio.h>
#include <stdlib.h>
#include <sys/statvfs.h>
#include <mntent.h>

int main() {
    FILE *mnt = setmntent("/etc/mtab", "r");
    if (!mnt) {
        perror("setmntent");
        return 1;
    }

    struct mntent *ent;

    printf("%-20s %-10s %-10s %-10s %-10s %s\n", 
           "Filesystem", "Inodes", "IUsed", "IFree", "IUse%", "Mounted on");

    while ((ent = getmntent(mnt)) != NULL) {
        struct statvfs vfs;

        // 파일시스템의 inode 정보 수집
        if (statvfs(ent->mnt_dir, &vfs) != 0)
            continue;

        unsigned long total_inodes = vfs.f_files;
        unsigned long free_inodes = vfs.f_ffree;
        unsigned long used_inodes = total_inodes - free_inodes;

        // inode 사용률 계산
        int usage = (total_inodes > 0) ? (int)((double)used_inodes / total_inodes * 100) : 0;

        // 최종 출력
        printf("%-20s %-10lu %-10lu %-10lu %-9d%% %s\n",
               ent->mnt_fsname, total_inodes, used_inodes, free_inodes, usage, ent->mnt_dir);
    }

    endmntent(mnt);
    return 0;
}

```

---

###  24. grep -i
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// 대소문자 무시 비교용 strstr 함수
char *strcasestr_custom(const char *haystack, const char *needle) {
    while (*haystack) {
        const char *h = haystack;
        const char *n = needle;
        while (*h && *n && tolower((unsigned char)*h) == tolower((unsigned char)*n)) {
            h++;
            n++;
        }
        if (*n == '\0') return (char *)haystack;
        haystack++;
    }
    return NULL;
}

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-i") != 0) {
        fprintf(stderr, "사용법: %s -i <pattern> <filename>\n", argv[0]);
        return 1;
    }

    const char *pattern = argv[2];
    const char *filename = argv[3];

    FILE *fp = fopen(filename, "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char line[1024];
    while (fgets(line, sizeof(line), fp)) {
        if (strcasestr_custom(line, pattern)) {
            printf("%s", line);
        }
    }

    fclose(fp);
    return 0;
}

```

---

###  25. grep -v
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-v") != 0) {
        fprintf(stderr, "사용법: %s -v <pattern> <filename>\n", argv[0]);
        return 1;
    }

    const char *pattern = argv[2];
    const char *filename = argv[3];

    FILE *fp = fopen(filename, "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char line[1024];
    while (fgets(line, sizeof(line), fp)) {
        if (!strstr(line, pattern)) {
            printf("%s", line);
        }
    }

    fclose(fp);
    return 0;
}

```

---

###  26. grep -n
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-n") != 0) {
        fprintf(stderr, "사용법: %s -n <pattern> <filename>\n", argv[0]);
        return 1;
    }

    const char *pattern = argv[2];
    const char *filename = argv[3];

    FILE *fp = fopen(filename, "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char line[1024];
    int lineno = 1;
    while (fgets(line, sizeof(line), fp)) {
        if (strstr(line, pattern)) {
            printf("%d:%s", lineno, line);
        }
        lineno++;
    }

    fclose(fp);
    return 0;
}

```

---

###  27. grep -c
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-c") != 0) {
        fprintf(stderr, "사용법: %s -c <pattern> <filename>\n", argv[0]);
        return 1;
    }

    const char *pattern = argv[2];
    const char *filename = argv[3];

    FILE *fp = fopen(filename, "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char line[1024];
    int count = 0;
    while (fgets(line, sizeof(line), fp)) {
        if (strstr(line, pattern)) {
            count++;
        }
    }

    printf("%d\n", count);

    fclose(fp);
    return 0;
}

```

---

###  28. grep -l
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int search_file(const char *pattern, const char *filename) {
    FILE *fp = fopen(filename, "r");
    if (!fp) return 0;

    char line[1024];
    while (fgets(line, sizeof(line), fp)) {
        if (strstr(line, pattern)) {
            fclose(fp);
            return 1; // 찾으면 바로 종료
        }
    }

    fclose(fp);
    return 0;
}

int main(int argc, char *argv[]) {
    if (argc < 4 || strcmp(argv[1], "-l") != 0) {
        fprintf(stderr, "사용법: %s -l <pattern> <file1> [file2 ...]\n", argv[0]);
        return 1;
    }

    const char *pattern = argv[2];

    for (int i = 3; i < argc; i++) {
        if (search_file(pattern, argv[i])) {
            printf("%s\n", argv[i]);
        }
    }

    return 0;
}

```

---

###  29. cp
```
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "사용법: %s <원본> <대상>\n", argv[0]);
        return 1;
    }

    FILE *src = fopen(argv[1], "rb");
    if (!src) {
        perror("원본 파일 열기 실패");
        return 1;
    }

    FILE *dest = fopen(argv[2], "wb");
    if (!dest) {
        perror("대상 파일 열기 실패");
        fclose(src);
        return 1;
    }

    char buf[4096];
    size_t size;
    while ((size = fread(buf, 1, sizeof(buf), src)) > 0) {
        fwrite(buf, 1, size, dest);
    }

    fclose(src);
    fclose(dest);
    return 0;
}

```

---

###  30. cp - i
```
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-i") != 0) {
        fprintf(stderr, "사용법: %s -i <원본> <대상>\n", argv[0]);
        return 1;
    }

    FILE *src = fopen(argv[2], "rb");
    if (!src) {
        perror("원본 파일 열기 실패");
        return 1;
    }

    FILE *check = fopen(argv[3], "r");
    if (check) {
        fclose(check);
        printf("'%s' 파일이 이미 존재합니다. 덮어쓰시겠습니까? (y/n): ", argv[3]);
        char answer = getchar();
        if (answer != 'y' && answer != 'Y') {
            fclose(src);
            printf("복사 취소됨.\n");
            return 0;
        }
    }

    FILE *dest = fopen(argv[3], "wb");
    if (!dest) {
        perror("대상 파일 열기 실패");
        fclose(src);
        return 1;
    }

    char buf[4096];
    size_t size;
    while ((size = fread(buf, 1, sizeof(buf), src)) > 0) {
        fwrite(buf, 1, size, dest);
    }

    fclose(src);
    fclose(dest);
    return 0;
}

```

---

###  31. cp - f
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-f") != 0) {
        fprintf(stderr, "사용법: %s -f <원본> <대상>\n", argv[0]);
        return 1;
    }

    FILE *src = fopen(argv[2], "rb");
    if (!src) {
        perror("원본 파일 열기 실패");
        return 1;
    }

    remove(argv[3]);  // 대상 파일이 있다면 삭제

    FILE *dest = fopen(argv[3], "wb");
    if (!dest) {
        perror("대상 파일 열기 실패");
        fclose(src);
        return 1;
    }

    char buf[4096];
    size_t size;
    while ((size = fread(buf, 1, sizeof(buf), src)) > 0) {
        fwrite(buf, 1, size, dest);
    }

    fclose(src);
    fclose(dest);
    return 0;
}

```

---

###  32. cp - n
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-n") != 0) {
        fprintf(stderr, "사용법: %s -n <원본> <대상>\n", argv[0]);
        return 1;
    }

    FILE *check = fopen(argv[3], "r");
    if (check) {
        fclose(check);
        printf("'%s' 파일이 이미 존재합니다. 복사하지 않습니다.\n", argv[3]);
        return 0;
    }

    FILE *src = fopen(argv[2], "rb");
    if (!src) {
        perror("원본 파일 열기 실패");
        return 1;
    }

    FILE *dest = fopen(argv[3], "wb");
    if (!dest) {
        perror("대상 파일 열기 실패");
        fclose(src);
        return 1;
    }

    char buf[4096];
    size_t size;
    while ((size = fread(buf, 1, sizeof(buf), src)) > 0) {
        fwrite(buf, 1, size, dest);
    }

    fclose(src);
    fclose(dest);
    return 0;
}

```

---

###  33. cp - v
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-v") != 0) {
        fprintf(stderr, "사용법: %s -v <원본> <대상>\n", argv[0]);
        return 1;
    }

    FILE *src = fopen(argv[2], "rb");
    if (!src) {
        perror("원본 파일 열기 실패");
        return 1;
    }

    FILE *dest = fopen(argv[3], "wb");
    if (!dest) {
        perror("대상 파일 열기 실패");
        fclose(src);
        return 1;
    }

    printf("'%s' -> '%s'\n", argv[2], argv[3]);

    char buf[4096];
    size_t size;
    while ((size = fread(buf, 1, sizeof(buf), src)) > 0) {
        fwrite(buf, 1, size, dest);
    }

    fclose(src);
    fclose(dest);
    return 0;
}

```

---

###  34. clear
```
#include <stdio.h>

int main() {
    // ANSI escape sequence: 화면 지우고 커서를 (0,0) 위치로 이동
    printf("\033[2J\033[H");
    return 0;
}

```

---

###  35. chmod
```
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "사용법: %s <모드(8진수)> <파일명>\n", argv[0]);
        return 1;
    }

    // 8진수 권한 문자열을 정수로 변환
    mode_t mode = strtol(argv[1], NULL, 8);

    // 권한 변경 시도
    if (chmod(argv[2], mode) != 0) {
        perror("chmod 실패");
        return 1;
    }

    printf("'%s' 권한이 %s로 변경되었습니다.\n", argv[2], argv[1]);
    return 0;
}

```

---

###  36. sort
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 1000
#define MAX_LINE_LEN 1024

// 문자열 비교용 함수 (기본 정렬 기준)
int compare(const void *a, const void *b) {
    const char *str1 = *(const char **)a;
    const char *str2 = *(const char **)b;
    return strcmp(str1, str2);
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "사용법: %s <파일명>\n", argv[0]);
        return 1;
    }

    FILE *fp = fopen(argv[1], "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char *lines[MAX_LINES];
    int count = 0;
    char buffer[MAX_LINE_LEN];

    // 한 줄씩 읽어서 메모리에 저장
    while (fgets(buffer, sizeof(buffer), fp)) {
        lines[count] = strdup(buffer);  // strdup: 문자열 복사
        count++;
        if (count >= MAX_LINES) break;
    }
    fclose(fp);

    // 정렬 수행
    qsort(lines, count, sizeof(char *), compare);

    // 출력
    for (int i = 0; i < count; i++) {
        printf("%s", lines[i]);
        free(lines[i]);  // 메모리 해제
    }

    return 0;
}

```

---

###  37. sort -r
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 1000
#define MAX_LEN 1024

int compare_desc(const void *a, const void *b) {
    return strcmp(*(const char **)b, *(const char **)a); // 역순
}

int main(int argc, char *argv[]) {
    if (argc != 3 || strcmp(argv[1], "-r") != 0) {
        fprintf(stderr, "사용법: %s -r <파일명>\n", argv[0]);
        return 1;
    }

    FILE *fp = fopen(argv[2], "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char *lines[MAX_LINES];
    char buffer[MAX_LEN];
    int count = 0;

    while (fgets(buffer, sizeof(buffer), fp) && count < MAX_LINES) {
        lines[count++] = strdup(buffer);
    }
    fclose(fp);

    qsort(lines, count, sizeof(char *), compare_desc);

    for (int i = 0; i < count; i++) {
        printf("%s", lines[i]);
        free(lines[i]);
    }

    return 0;
}

```

---

###  38. sort -n
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 1000
#define MAX_LEN 1024

int compare_num(const void *a, const void *b) {
    int num1 = atoi(*(const char **)a);
    int num2 = atoi(*(const char **)b);
    return num1 - num2;
}

int main(int argc, char *argv[]) {
    if (argc != 3 || strcmp(argv[1], "-n") != 0) {
        fprintf(stderr, "사용법: %s -n <파일명>\n", argv[0]);
        return 1;
    }

    FILE *fp = fopen(argv[2], "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char *lines[MAX_LINES];
    char buffer[MAX_LEN];
    int count = 0;

    while (fgets(buffer, sizeof(buffer), fp) && count < MAX_LINES) {
        lines[count++] = strdup(buffer);
    }
    fclose(fp);

    qsort(lines, count, sizeof(char *), compare_num);

    for (int i = 0; i < count; i++) {
        printf("%s", lines[i]);
        free(lines[i]);
    }

    return 0;
}

```

---

###  39. sort -u
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 1000
#define MAX_LEN 1024

int compare(const void *a, const void *b) {
    return strcmp(*(const char **)a, *(const char **)b);
}

int main(int argc, char *argv[]) {
    if (argc != 3 || strcmp(argv[1], "-u") != 0) {
        fprintf(stderr, "사용법: %s -u <파일명>\n", argv[0]);
        return 1;
    }

    FILE *fp = fopen(argv[2], "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char *lines[MAX_LINES];
    char buffer[MAX_LEN];
    int count = 0;

    while (fgets(buffer, sizeof(buffer), fp) && count < MAX_LINES) {
        lines[count++] = strdup(buffer);
    }
    fclose(fp);

    qsort(lines, count, sizeof(char *), compare);

    // 중복 제거 후 출력
    for (int i = 0; i < count; i++) {
        if (i == 0 || strcmp(lines[i], lines[i - 1]) != 0) {
            printf("%s", lines[i]);
        }
        free(lines[i]);
    }

    return 0;
}

```

---

###  40. sort -k
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 1000
#define MAX_LEN 1024

int column = 1;

char *get_field(const char *line, int col) {
    static char copy[MAX_LEN];
    strcpy(copy, line);
    char *token = strtok(copy, " \t\n");
    int i = 1;
    while (token && i < col) {
        token = strtok(NULL, " \t\n");
        i++;
    }
    return token ? token : "";
}

int compare_field(const void *a, const void *b) {
    const char *fa = get_field(*(const char **)a, column);
    const char *fb = get_field(*(const char **)b, column);
    return strcmp(fa, fb);
}

int main(int argc, char *argv[]) {
    if (argc != 4 || strcmp(argv[1], "-k") != 0) {
        fprintf(stderr, "사용법: %s -k <열 번호> <파일명>\n", argv[0]);
        return 1;
    }

    column = atoi(argv[2]);
    if (column <= 0) {
        fprintf(stderr, "열 번호는 1 이상이어야 합니다.\n");
        return 1;
    }

    FILE *fp = fopen(argv[3], "r");
    if (!fp) {
        perror("파일 열기 실패");
        return 1;
    }

    char *lines[MAX_LINES];
    char buffer[MAX_LEN];
    int count = 0;

    while (fgets(buffer, sizeof(buffer), fp) && count < MAX_LINES) {
        lines[count++] = strdup(buffer);
    }
    fclose(fp);

    qsort(lines, count, sizeof(char *), compare_field);

    for (int i = 0; i < count; i++) {
        printf("%s", lines[i]);
        free(lines[i]);
    }

    return 0;
}

```

---

###  41. find
```
#include <stdio.h>
#include <dirent.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>

void find(const char *path) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        // 현재 디렉토리(.)와 상위 디렉토리(..)는 제외
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        // 전체 경로 구성
        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        printf("%s\n", fullpath);  // 파일 또는 디렉터리 출력

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0 && S_ISDIR(statbuf.st_mode)) {
            // 하위 디렉토리면 재귀적으로 탐색
            find(fullpath);
        }
    }
    closedir(dp);
}

int main(int argc, char *argv[]) {
    const char *start = argc > 1 ? argv[1] : ".";
    find(start);
    return 0;
}


```

---

###  42. find -name
```
#include <stdio.h>
#include <dirent.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>
#include <fnmatch.h>

void find(const char *path, const char *pattern) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        // 현재/상위 디렉토리 제외
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        // 패턴 일치 확인
        if (fnmatch(pattern, entry->d_name, 0) == 0) {
            printf("%s\n", fullpath);
        }

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0 && S_ISDIR(statbuf.st_mode)) {
            find(fullpath, pattern);  // 하위 디렉토리 재귀 탐색
        }
    }
    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "사용법: %s <디렉토리> <패턴>\n", argv[0]);
        return 1;
    }
    find(argv[1], argv[2]);
    return 0;
}

```

---

###  43. find -type
```
#include <stdio.h>
#include <dirent.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>

void find(const char *path, char type) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            if ((type == 'f' && S_ISREG(statbuf.st_mode)) ||
                (type == 'd' && S_ISDIR(statbuf.st_mode))) {
                printf("%s\n", fullpath);
            }

            // 디렉토리면 계속 재귀 탐색
            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, type);
            }
        }
    }
    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3 || (argv[2][0] != 'f' && argv[2][0] != 'd')) {
        fprintf(stderr, "사용법: %s <디렉토리> <f|d>\n", argv[0]);
        return 1;
    }
    find(argv[1], argv[2][0]);
    return 0;
}

```

---

###  44. find -size
```
#include <stdio.h>
#include <dirent.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>

long parse_size(const char *str) {
    char unit = str[strlen(str) - 1];
    long multiplier = 1;
    char size_str[100];
    strncpy(size_str, str + 1, sizeof(size_str));  // + 또는 - 기호 제외
    size_str[sizeof(size_str) - 1] = '\0';

    if (unit == 'k' || unit == 'K') multiplier = 1024;
    else if (unit == 'M') multiplier = 1024 * 1024;
    else if (unit == 'G') multiplier = 1024 * 1024 * 1024;
    else unit = '\0';  // no unit

    if (unit != '\0')
        size_str[strlen(size_str) - 1] = '\0';  // 단위 제거

    return atol(size_str) * multiplier;
}

void find(const char *path, char op, long target_size) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            if (S_ISREG(statbuf.st_mode)) {
                if ((op == '+' && statbuf.st_size > target_size) ||
                    (op == '-' && statbuf.st_size < target_size)) {
                    printf("%s\n", fullpath);
                }
            }
            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, op, target_size);
            }
        }
    }
    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3 || (argv[2][0] != '+' && argv[2][0] != '-')) {
        fprintf(stderr, "사용법: %s <디렉토리> <+크기|−크기> (예: +100k)\n", argv[0]);
        return 1;
    }

    long size = parse_size(argv[2]);
    char op = argv[2][0];

    find(argv[1], op, size);
    return 0;
}

```

---

###  45. find -mtime
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <time.h>

void find(const char *path, char op, int days) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    time_t now = time(NULL);

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            time_t mtime = statbuf.st_mtime;
            double diff_days = difftime(now, mtime) / (60 * 60 * 24);

            if ((op == '-' && diff_days < days) ||
                (op == '+' && diff_days > days) ||
                (op == '=' && (int)diff_days == days)) {
                printf("%s\n", fullpath);
            }

            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, op, days);
            }
        }
    }

    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3 || (argv[2][0] != '-' && argv[2][0] != '+' && argv[2][0] != '=')) {
        fprintf(stderr, "사용법: %s <디렉토리> <-N | +N | =N>\n", argv[0]);
        return 1;
    }

    char op = argv[2][0];
    int days = atoi(argv[2] + 1);

    find(argv[1], op, days);
    return 0;
}

```

---

###  46. find -atime
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <time.h>

void find(const char *path, char op, int days) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    time_t now = time(NULL);

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            time_t mtime = statbuf.st_mtime;
            double diff_days = difftime(now, mtime) / (60 * 60 * 24);

            if ((op == '-' && diff_days < days) ||
                (op == '+' && diff_days > days) ||
                (op == '=' && (int)diff_days == days)) {
                printf("%s\n", fullpath);
            }

            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, op, days);
            }
        }
    }

    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3 || (argv[2][0] != '-' && argv[2][0] != '+' && argv[2][0] != '=')) {
        fprintf(stderr, "사용법: %s <디렉토리> <-N | +N | =N>\n", argv[0]);
        return 1;
    }

    char op = argv[2][0];
    int days = atoi(argv[2] + 1);

    find(argv[1], op, days);
    return 0;
}

```

---

###  47. find -perm
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>

void find(const char *path, mode_t target_perm) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            mode_t file_perm = statbuf.st_mode & 0777;

            if (file_perm == target_perm) {
                printf("%s\n", fullpath);
            }

            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, target_perm);
            }
        }
    }

    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "사용법: %s <디렉토리> <권한(8진수)>\n", argv[0]);
        return 1;
    }

    mode_t perm = strtol(argv[2], NULL, 8);  // 8진수로 입력 받음

    find(argv[1], perm);
    return 0;
}

```

---

###  48. find -user
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <pwd.h>

void find(const char *path, uid_t target_uid) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            if (statbuf.st_uid == target_uid) {
                printf("%s\n", fullpath);
            }

            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, target_uid);
            }
        }
    }

    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "사용법: %s <디렉토리> <사용자 이름>\n", argv[0]);
        return 1;
    }

    struct passwd *pw = getpwnam(argv[2]);
    if (!pw) {
        fprintf(stderr, "사용자를 찾을 수 없습니다: %s\n", argv[2]);
        return 1;
    }

    find(argv[1], pw->pw_uid);
    return 0;
}

```

---

###  49. find -group
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <grp.h>

void find(const char *path, gid_t target_gid) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (stat(fullpath, &statbuf) == 0) {
            if (statbuf.st_gid == target_gid) {
                printf("%s\n", fullpath);
            }

            if (S_ISDIR(statbuf.st_mode)) {
                find(fullpath, target_gid);
            }
        }
    }

    closedir(dp);
}

int main(int argc, char *argv[]) {
    i

```

---

###  50. find -delete
```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <unistd.h>
#include <sys/stat.h>

void delete_recursive(const char *path) {
    struct dirent *entry;
    DIR *dp = opendir(path);
    if (!dp) return;

    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0)
            continue;

        char fullpath[1024];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", path, entry->d_name);

        struct stat statbuf;
        if (lstat(fullpath, &statbuf) == 0) {
            if (S_ISDIR(statbuf.st_mode)) {
                // 디렉토리는 내부 먼저 지우고 나중에 rmdir
                delete_recursive(fullpath);
                rmdir(fullpath);
                printf("디렉토리 삭제됨: %s\n", fullpath);
            } else {
                // 일반 파일/링크/디바이스 삭제
                unlink(fullpath);
                printf("파일 삭제됨: %s\n", fullpath);
            }
        }
    }

    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "사용법: %s <디렉토리>\n", argv[0]);
        return 1;
    }

    delete_recursive(argv[1]);
    return 0;
}

```



