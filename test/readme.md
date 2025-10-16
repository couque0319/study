// KBO CLASSIC Scoreboard - Ultimate Edition (CMD optimized)
// Build: cl /EHsc /std:c++17 kbo_classic.cpp

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <windows.h>
#include <conio.h>
#include <thread>
#include <atomic>
#include <algorithm>
#include <vector>
#include <string>
#include <numeric>

using namespace std;

#define REGULATION_INNING 9
#define MENU_CODE -999

atomic<bool> music_running(true);

// ========== UTF-8 콘솔 ==========
void setup_utf8() {
    SetConsoleOutputCP(65001);
    SetConsoleCP(65001);
}

// ========== 콘솔 유틸 ==========
void setColor(WORD color) {
    SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), color);
}
void draw_line() {
    printf("====================================================================================================\n");
}
int get_console_width() {
    CONSOLE_SCREEN_BUFFER_INFO csbi;
    if (GetConsoleScreenBufferInfo(GetStdHandle(STD_OUTPUT_HANDLE), &csbi)) {
        return csbi.srWindow.Right - csbi.srWindow.Left + 1;
    }
    return 100; // fallback
}
void print_centered(const char* s, int width) {
    int n = (int)strlen(s);
    int pad = (width - n) / 2;
    if (pad < 0) pad = 0;
    for (int i = 0; i < pad; ++i) putchar(' ');
    printf("%s\n", s);
}
int visual_length(const char *str) {
    int len = 0;
    for (int i = 0; str[i]; i++) {
        unsigned char c = str[i];
        if (c >= 0x80) { len += 2; i++; } // 단순 멀티바이트 폭 처리
        else len += 1;
    }
    return len;
}
void print_padded(const char* str, int width) {
    int vlen = visual_length(str);
    printf("%s", str);
    for (int i = 0; i < max(0, width - vlen); i++) printf(" ");
}

// 안전 정수 입력
int scan_int_safe() {
    int x;
    while (scanf("%d", &x) != 1) {
        while (getchar() != '\n'); // flush
        printf("숫자를 입력하세요: ");
    }
    while (getchar() != '\n') {} // 개행 제거
    return x;
}

// ========== 슬라이스 비프(즉시 중단) ==========
static void interruptibleBeep(int freq, int total_ms, atomic<bool>& flag, int slice_ms = 15) {
    int left = total_ms;
    while (left > 0 && flag) {
        int d = (left < slice_ms) ? left : slice_ms;
        if (freq == 0) Sleep(d);
        else Beep(freq, d);
        left -= d;
    }
}
void playKBOMelody() {
    const int melody[][2] = {
        {523,120}, {659,120}, {784,130}, {880,120},
        {988,120}, {880,120}, {784,100}, {659,100},
        {784,130}, {659,110}, {523,250}, {0,100},
        {784,100}, {880,100}, {988,130}, {1046,130},
        {988,120}, {880,100}, {784,100}, {659,100},
        {523,150}, {0,150},
    };
    const int N = sizeof(melody)/sizeof(melody[0]);
    while (music_running) {
        for (int i = 0; i < N; ++i) {
            if (!music_running) return;
            interruptibleBeep(melody[i][0], melody[i][1], music_running, 15);
        }
    }
}

// ========== 테마(배경 포함) ==========
struct Theme {
    WORD hl = 11;     // 하이라이트
    WORD home = 12;   // 홈팀
    WORD away = 9;    // 원정팀
    WORD normal = 7;  // 일반
    const char* console_code = "07"; // CMD color 코드(배경+전경)
};
Theme theme_default{ 11,12,9,7,"07" };  // 검정 배경 + 밝은 회색 글자
Theme theme_dark{    14,10,13,15,"1F" }; // 파랑 배경 + 밝은 흰색(전광판 느낌)
Theme theme = theme_default;

void apply_console_theme(const char* code) {
    char cmd[16]; snprintf(cmd, sizeof(cmd), "color %s", code);
    system(cmd);                 // 배경/전경 색 적용(화면 지워짐)
    setColor(theme.normal);      // 기본 전경색 정렬
}
void toggle_theme() {
    bool is_default =
        (theme.hl == theme_default.hl &&
         theme.home == theme_default.home &&
         theme.away == theme_default.away &&
         theme.normal == theme_default.normal);
    theme = is_default ? theme_dark : theme_default;
    apply_console_theme(theme.console_code);
    system("cls");
}

// ========== 인트로 ==========
void intro_screen() {
    system("cls");
    printf("\n");
    printf("██╗  ██╗██████╗  ██████╗      ██████╗██╗      █████╗ ███████╗███████╗██╗ ██████╗\n");
    printf("██║ ██╔╝██╔══██╗██╔════╝     ██╔════╝██║     ██╔══██╗██╔════╝██╔════╝██║██╔════╝\n");
    printf("█████╔╝ ██████╔╝██║  ███╗    ██║     ██║     ███████║███████╗█████╗  ██║██║     \n");
    printf("██╔═██╗ ██╔══━╝ ██║   ██║    ██║     ██║     ██╔══██║╚════██║██╔══╝  ██║██║     \n");
    printf("██║  ██╗██║     ╚██████╔╝    ╚██████╗███████╗██║  ██║███████║███████╗██║╚██████╗\n");
    printf("╚═╝  ╚═╝╚═╝      ╚═════╝      ╚═════╝╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝ ╚═════╝\n");
    printf("\n");
    int cw = get_console_width();
    print_centered("⚾  KBO CLASSIC  ⚾", cw);
    print_centered("▶ PRESS ENTER TO START ◀", cw);
}

// ========== 데이터 구조(동적 이닝) ==========
struct TeamName { char name[20]; };
struct GameData {
    vector<int> R[2], H[2], E[2], B[2]; // -1 미진행
    void init(int innings = REGULATION_INNING) {
        for (int t=0; t<2; ++t) {
            R[t] = vector<int>(innings, -1);
            H[t] = vector<int>(innings,  0);
            E[t] = vector<int>(innings,  0);
            B[t] = vector<int>(innings,  0);
        }
    }
    int innings() const { return (int)R[0].size(); }
    void push_one_inning() {
        for (int t=0; t<2; ++t) {
            R[t].push_back(-1);
            H[t].push_back(0);
            E[t].push_back(0);
            B[t].push_back(0);
        }
    }
};

void input_team(TeamName team[2]) {
    printf("1팀 이름 입력 : ");
    scanf("%19s", team[0].name); while(getchar()!='\n'){}
    printf("2팀 이름 입력 : ");
    scanf("%19s", team[1].name); while(getchar()!='\n'){}
}

int sum_nonneg(const vector<int>& v){ int s=0; for(int x:v) if(x>=0)s+=x; return s; }
int sum_vec(const vector<int>& v){ return accumulate(v.begin(),v.end(),0); }

// ========== 스코어보드 ==========
void print_team_name(const char* name, bool isHome, int width) {
    setColor(isHome ? theme.home : theme.away);
    print_padded(name, width);
    setColor(theme.normal);
}
void display_scoreboard(TeamName team[2], const GameData& gd,
                        int highlightTeam=-1, int highlightInning=-1) {
    int max_len = max(visual_length(team[0].name), visual_length(team[1].name)) + 2;
    int INN = gd.innings();

    draw_line();
    print_padded("회차", max_len);
    printf("|");
    for (int i=1;i<=INN;i++) printf(" %2d", i);
    printf(" |  R  H  E  B\n");
    draw_line();

    for (int t=0; t<2; t++) {
        print_team_name(team[t].name, t==1, max_len);
        printf("|");
        for (int i=0;i<INN;i++) {
            bool isHL = (t==highlightTeam && i==highlightInning);
            int ri = gd.R[t][i];
            if (ri < 0) {
                if (isHL) { setColor(theme.hl); printf(" [-]"); setColor(theme.normal); }
                else       { printf("  -"); }
            } else {
                if (isHL) { setColor(theme.hl); printf(" [%2d]", ri); setColor(theme.normal); }
                else       { printf(" %2d", ri); }
            }
        }
        int Rt=sum_nonneg(gd.R[t]), Ht=sum_vec(gd.H[t]), Et=sum_vec(gd.E[t]), Bt=sum_vec(gd.B[t]);
        printf(" | %2d %2d %2d %2d\n", Rt,Ht,Et,Bt);
    }
    draw_line();
}

// ========== 입력(정규 이닝) ==========
bool input_regulation(TeamName team[2], GameData& gd, int auto_mode) {
    system("cls");
    display_scoreboard(team, gd);

    int INN = gd.innings();
    for (int i=0; i<INN; i++) {
        for (int t=0; t<2; t++) {
            if (auto_mode == 2) {
                gd.R[t][i]=rand()%5; gd.H[t][i]=rand()%4; gd.E[t][i]=rand()%2; gd.B[t][i]=rand()%3;
            } else {
                system("cls");
                display_scoreboard(team, gd, t, i);
                printf("\n현재: [%s - %d회차]\n", team[t].name, i+1);
                printf("(메뉴로 돌아가려면 %d 입력)\n", MENU_CODE);
                int rr,hh,ee,bb;
                printf("점수 : "); rr=scan_int_safe(); if(rr==MENU_CODE) return false;
                printf("안타 : "); hh=scan_int_safe(); if(hh==MENU_CODE) return false;
                printf("실책 : "); ee=scan_int_safe(); if(ee==MENU_CODE) return false;
                printf("포볼 : "); bb=scan_int_safe(); if(bb==MENU_CODE) return false;
                gd.R[t][i]=max(0,rr); gd.H[t][i]=max(0,hh); gd.E[t][i]=max(0,ee); gd.B[t][i]=max(0,bb);

                system("cls");
                int nextTeam=(t==0?1:-1), nextInning=(t==0?i:-1);
                display_scoreboard(team, gd, nextTeam, nextInning);
            }

            // ESC/H 빠른 처리
            if (_kbhit()) {
                int ch=_getch();
                if (ch==27) return false; // ESC
                if (ch=='h'||ch=='H') {
                    system("cls");
                    printf("[도움말]\n- 수동 입력 중 %d 입력 시 메뉴 복귀\n- ESC: 메뉴 복귀\n- H: 도움말\n\n", MENU_CODE);
                    printf("아무 키나 누르면 계속...");
                    _getch();
                }
            }
        }
    }
    system("cls");
    display_scoreboard(team, gd);
    return true;
}

// ========== 입력(연장전) ==========
bool input_extra(TeamName team[2], GameData& gd, int auto_mode) {
    int inningNo = gd.innings()+1;
    gd.push_one_inning();
    int i = gd.innings()-1;

    for (int t=0; t<2; t++) {
        if (auto_mode == 2) {
            gd.R[t][i]=rand()%5; gd.H[t][i]=rand()%4; gd.E[t][i]=rand()%2; gd.B[t][i]=rand()%3;
        } else {
            system("cls");
            display_scoreboard(team, gd, t, i);
            printf("\n[연장 %d회 - %s]\n(메뉴로 돌아가려면 %d 입력)\n", inningNo, team[t].name, MENU_CODE);
            int rr,hh,ee,bb;
            printf("점수 : "); rr=scan_int_safe(); if(rr==MENU_CODE) return false;
            printf("안타 : "); hh=scan_int_safe(); if(hh==MENU_CODE) return false;
            printf("실책 : "); ee=scan_int_safe(); if(ee==MENU_CODE) return false;
            printf("포볼 : "); bb=scan_int_safe(); if(bb==MENU_CODE) return false;
            gd.R[t][i]=max(0,rr); gd.H[t][i]=max(0,hh); gd.E[t][i]=max(0,ee); gd.B[t][i]=max(0,bb);
        }
        if (_kbhit() && _getch()==27) return false; // ESC
    }
    system("cls"); display_scoreboard(team, gd);
    return true;
}

// ========== 결과/저장 ==========
void print_result(TeamName team[2], const GameData& gd) {
    int awayR=sum_nonneg(gd.R[0]), homeR=sum_nonneg(gd.R[1]);
    draw_line();
    if (awayR>homeR){ setColor(10); printf("%s 승리!\n", team[0].name); }
    else if (homeR>awayR){ setColor(12); printf("%s 승리!\n", team[1].name); }
    else { setColor(14); printf("무승부!\n"); }
    setColor(theme.normal);
    draw_line();
}
void save_result_txt(TeamName team[2], const GameData& gd) {
    FILE* fp=fopen("score.txt","w"); if(!fp) return;
    int INN=gd.innings();
    fprintf(fp,"[Game Result]\n");
    fprintf(fp,"%-10s R:%2d  H:%2d  E:%2d  B:%2d\n",team[0].name,
            sum_nonneg(gd.R[0]), sum_vec(gd.H[0]), sum_vec(gd.E[0]), sum_vec(gd.B[0]));
    fprintf(fp,"%-10s R:%2d  H:%2d  E:%2d  B:%2d\n",team[1].name,
            sum_nonneg(gd.R[1]), sum_vec(gd.H[1]), sum_vec(gd.E[1]), sum_vec(gd.B[1]));
    fprintf(fp,"\n[Line Score]\n        ");
    for(int i=1;i<=INN;i++) fprintf(fp," %2d",i);
    fprintf(fp,"\n");
    auto line=[&](int t){
        fprintf(fp,"%-8s",team[t].name);
        for(int i=0;i<INN;i++){
            if(gd.R[t][i]<0) fprintf(fp,"  -");
            else fprintf(fp," %2d",gd.R[t][i]);
        }
        fprintf(fp," |  R:%2d H:%2d E:%2d B:%2d\n",
            sum_nonneg(gd.R[t]), sum_vec(gd.H[t]), sum_vec(gd.E[t]), sum_vec(gd.B[t]));
    };
    line(0); line(1);
    int awayR=sum_nonneg(gd.R[0]), homeR=sum_nonneg(gd.R[1]);
    if (awayR>homeR) fprintf(fp,"\nWinner: %s\n",team[0].name);
    else if (homeR>awayR) fprintf(fp,"\nWinner: %s\n",team[1].name);
    else fprintf(fp,"\nResult: Draw\n");
    fclose(fp);
}
void save_result_csv(TeamName team[2], const GameData& gd) {
    FILE* fp=fopen("score.csv","w"); if(!fp) return;
    int INN=gd.innings();
    fprintf(fp,"Team"); for(int i=1;i<=INN;i++) fprintf(fp,",%d",i);
    fprintf(fp,",R,H,E,B\n");
    auto line=[&](int t){
        fprintf(fp,"%s",team[t].name);
        for(int i=0;i<INN;i++){
            if(gd.R[t][i]<0) fprintf(fp,",");
            else fprintf(fp,",%d",gd.R[t][i]);
        }
        fprintf(fp,",%d,%d,%d,%d\n",
            sum_nonneg(gd.R[t]), sum_vec(gd.H[t]), sum_vec(gd.E[t]), sum_vec(gd.B[t]));
    };
    line(0); line(1); fclose(fp);
}

// ========== 이닝 수정 ==========
void edit_inning(TeamName team[2], GameData& gd) {
    system("cls"); display_scoreboard(team, gd);
    printf("\n수정할 팀 (0:원정, 1:홈): "); int t=scan_int_safe();
    printf("수정할 회차 (1~%d): ", gd.innings()); int i=scan_int_safe(); i--;
    if (t<0||t>1||i<0||i>=gd.innings()) { printf("범위를 벗어났습니다.\n엔터..."); getchar(); return; }
    printf("\n현재 값: 점수=%d, 안타=%d, 실책=%d, 포볼=%d\n",
           gd.R[t][i]<0?0:gd.R[t][i], gd.H[t][i], gd.E[t][i], gd.B[t][i]);
    printf("새 점수: "); int rr=scan_int_safe(); if(rr<0) rr=0;
    printf("새 안타: "); int hh=scan_int_safe(); if(hh<0) hh=0;
    printf("새 실책: "); int ee=scan_int_safe(); if(ee<0) ee=0;
    printf("새 포볼: "); int bb=scan_int_safe(); if(bb<0) bb=0;
    gd.R[t][i]=rr; gd.H[t][i]=hh; gd.E[t][i]=ee; gd.B[t][i]=bb;
    system("cls"); display_scoreboard(team, gd);
    printf("\n수정 완료. 엔터를 누르면 메뉴로 돌아갑니다..."); getchar();
}

// ========== 도움말 ==========
void show_help() {
    system("cls");
    printf("=== 도움말 ===\n");
    printf("- 인트로: 엔터 → 음악 즉시 종료\n");
    printf("- 메뉴: 숫자키(1~5), H(도움말), ESC(종료) → 엔터 없이 즉시 반응\n");
    printf("- 수동 입력 중 %d 입력 → 메뉴로 복귀(데이터 유지)\n", MENU_CODE);
    printf("- 9회 종료 후 동점이면 연장전 진행(이닝 자동 확장)\n");
    printf("- 4) 이닝/점수 수정: 과거 이닝 점수/안타/실책/포볼 수정\n");
    printf("- 5) 색상 테마 토글: CMD 배경/글자색 전환\n");
    printf("\n아무 키나 누르면 돌아갑니다..."); _getch();
}

// ========== 메뉴 단일 키 입력 ==========
int get_menu_choice() {
    while (true) {
        printf("선택: ");
        int ch = _getch();
        if (ch == 0 || ch == 224) { _getch(); printf("\n"); continue; } // 특수키 무시
        if (ch == 27) return 9;            // ESC -> 종료
        if (ch == 'h' || ch == 'H') return 'H';
        if (ch >= '1' && ch <= '5') return ch - '0';
        if (ch == '9') return 9;
        Beep(400,80); printf("\n");        // 잘못된 키
    }
}

// ========== 메인 ==========
int main() {
    setup_utf8();
    srand((unsigned)time(NULL));
    apply_console_theme(theme.console_code); // 기본 테마 적용
    system("cls");

    // 인트로 + 음악
    thread music_thread(playKBOMelody);
    intro_screen();
    getchar();               // ENTER
    music_running = false;   // 즉시 종료
    music_thread.join();
    system("cls");

    TeamName team[2];
    GameData gd;

    printf("⚾ KBO CLASSIC 스코어보드 ⚾\n\n");
    input_team(team);
    gd.init(REGULATION_INNING);

    while (true) {
        system("cls");
        printf("=== 점수 입력 방법 선택 ===\n");
        printf("1) 수동 입력 모드\n");
        printf("2) 랜덤 시뮬레이션 모드\n");
        printf("3) 초기화 후 팀 다시 입력\n");
        printf("4) 이닝/점수 수정\n");
        printf("5) 색상 테마 토글\n");
        printf("H) 도움말  /  ESC) 종료\n\n");

        int choice = get_menu_choice();  // ← 엔터 없이 즉시 반응
        printf("\n");
        if (choice == 9) break;
        if (choice == 'H') { show_help(); continue; }
        if (choice == 5)   { toggle_theme(); continue; }
        if (choice == 4)   { edit_inning(team, gd); continue; }
        if (choice == 3)   { system("cls"); input_team(team); gd.init(REGULATION_INNING); continue; }
        if (choice != 1 && choice != 2) { printf("잘못된 선택. 아무 키나..."); _getch(); continue; }

        // 정규 이닝 입력
        bool finished = input_regulation(team, gd, choice);
        if (!finished) {
            system("cls");
            printf("메뉴로 돌아왔습니다. 현재까지 입력 내용은 유지됩니다.\n\n");
            display_scoreboard(team, gd);
            printf("\n아무 키나 누르면 메뉴로 이동합니다..."); _getch(); continue;
        }

        // 연장전
        int awayR=sum_nonneg(gd.R[0]), homeR=sum_nonneg(gd.R[1]);
        while (awayR == homeR) {
            system("cls"); display_scoreboard(team, gd);
            printf("\n동점입니다. 연장전을 진행할까요? (1:예 / 기타:아니오) : ");
            int go = scan_int_safe(); if (go != 1) break;
            bool ok = input_extra(team, gd, choice);
            if (!ok) break;
            awayR=sum_nonneg(gd.R[0]); homeR=sum_nonneg(gd.R[1]);
        }

        // 결과/저장
        system("cls");
        display_scoreboard(team, gd);
        print_result(team, gd);
        save_result_txt(team, gd);
        save_result_csv(team, gd);
        printf("\n결과가 'score.txt' 및 'score.csv' 파일로 저장되었습니다.\n");
        printf("1) 계속 (메뉴로)   2) 새 경기 시작(팀 재입력)   9) 종료\n선택: ");
        int aft = scan_int_safe();
        if (aft == 9) break;
        if (aft == 2) { input_team(team); gd.init(REGULATION_INNING); }
    }
    return 0;
}
