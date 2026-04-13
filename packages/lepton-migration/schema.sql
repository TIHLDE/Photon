create table apikey_apikey
(
    id          int auto_increment
        primary key,
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    `key`       char(32)     not null,
    title       varchar(255) not null,
    description longtext     null,
    is_active   tinyint(1)   not null,
    constraint `key`
        unique (`key`)
)
    collate = utf8mb4_unicode_ci;

create table auth_group
(
    id   int auto_increment
        primary key,
    name varchar(150) not null,
    constraint name
        unique (name)
)
    collate = utf8mb4_unicode_ci;

create table badge_badgecategory
(
    id          char(32)     not null
        primary key,
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    image       varchar(600) null,
    image_alt   varchar(200) null,
    name        varchar(100) not null,
    description longtext     not null
)
    collate = utf8mb4_unicode_ci;

create table badge_badge
(
    id                char(32)     not null
        primary key,
    created_at        datetime(6)  not null,
    updated_at        datetime(6)  not null,
    title             varchar(200) not null,
    image             varchar(600) null,
    image_alt         varchar(200) null,
    description       varchar(200) not null,
    active_from       datetime(6)  null,
    active_to         datetime(6)  null,
    flag              char(32)     not null,
    badge_category_id char(32)     null,
    constraint badge_badge_flag_92e3f4bc_uniq
        unique (flag),
    constraint badge_badge_badge_category_id_39937fe9_fk_badge_badgecategory_id
        foreign key (badge_category_id) references badge_badgecategory (id)
)
    collate = utf8mb4_unicode_ci;

create table career_jobpost
(
    id                     int auto_increment
        primary key,
    created_at             datetime(6)  not null,
    updated_at             datetime(6)  not null,
    image                  varchar(600) null,
    image_alt              varchar(200) null,
    title                  varchar(200) not null,
    ingress                varchar(800) not null,
    body                   longtext     not null,
    location               varchar(200) not null,
    deadline               datetime(6)  null,
    company                varchar(200) not null,
    email                  varchar(254) null,
    link                   varchar(300) null,
    is_continuously_hiring tinyint(1)   not null,
    class_end              int          not null,
    class_start            int          not null,
    job_type               varchar(30)  not null
)
    collate = utf8mb4_unicode_ci;

create table career_weeklybusiness
(
    id            char(32)          not null
        primary key,
    created_at    datetime(6)       not null,
    updated_at    datetime(6)       not null,
    image         varchar(600)      null,
    image_alt     varchar(200)      null,
    business_name varchar(200)      not null,
    body          longtext          not null,
    year          smallint unsigned not null,
    week          smallint unsigned not null,
    constraint career_weeklybusiness_year_week_378734e4_uniq
        unique (year, week)
)
    collate = utf8mb4_unicode_ci;

create table communication_banner
(
    id            char(32)     not null
        primary key,
    created_at    datetime(6)  not null,
    updated_at    datetime(6)  not null,
    image         varchar(600) null,
    image_alt     varchar(200) null,
    title         varchar(100) not null,
    description   longtext     not null,
    visible_from  datetime(6)  not null,
    visible_until datetime(6)  not null,
    url           varchar(600) null
)
    collate = utf8mb4_unicode_ci;

create table communication_mail
(
    id         char(32)     not null
        primary key,
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    eta        datetime(6)  not null,
    subject    varchar(200) not null,
    body       longtext     not null
)
    collate = utf8mb4_unicode_ci;

create table communication_warning
(
    id         int auto_increment
        primary key,
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    text       varchar(400) null,
    type       int          null
)
    collate = utf8mb4_unicode_ci;

create table content_category
(
    id         int auto_increment
        primary key,
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    text       varchar(200) null
)
    collate = utf8mb4_unicode_ci;

create table content_cheatsheet
(
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    id         char(32)     not null
        primary key,
    title      varchar(200) not null,
    creator    varchar(200) not null,
    grade      varchar(50)  not null,
    study      varchar(50)  not null,
    course     varchar(200) not null,
    url        varchar(600) not null,
    official   tinyint(1)   not null,
    type       varchar(50)  not null
)
    collate = utf8mb4_unicode_ci;

create table content_page
(
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    image      varchar(600) null,
    image_alt  varchar(200) null,
    page_id    char(32)     not null
        primary key,
    title      varchar(50)  not null,
    slug       varchar(50)  not null,
    content    longtext     not null,
    lft        int unsigned not null,
    rght       int unsigned not null,
    tree_id    int unsigned not null,
    level      int unsigned not null,
    parent_id  char(32)     null,
    `order`    int unsigned not null,
    constraint content_page_parent_id_slug_43253ba6_uniq
        unique (parent_id, slug),
    constraint content_page_parent_id_63631a6e_fk_content_page_page_id
        foreign key (parent_id) references content_page (page_id)
)
    collate = utf8mb4_unicode_ci;

create index content_page_order_5d2604b2
    on content_page (`order`);

create index content_page_parent_id_63631a6e
    on content_page (parent_id);

create index content_page_slug_d48c800c
    on content_page (slug);

create index content_page_tree_id_ed111ebf
    on content_page (tree_id);

create table content_qrcode
(
    id         int auto_increment
        primary key,
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    image      varchar(600) null,
    image_alt  varchar(200) null,
    name       varchar(50)  not null,
    user_id    varchar(15)  not null,
    content    varchar(600) not null
)
    collate = utf8mb4_unicode_ci;

create table content_toddel
(
    created_at   datetime(6)  not null,
    updated_at   datetime(6)  not null,
    edition      int          not null
        primary key,
    title        varchar(200) not null,
    image        varchar(600) not null,
    pdf          varchar(600) not null,
    published_at date         not null
)
    collate = utf8mb4_unicode_ci;

create table content_user
(
    password                   varchar(128) not null,
    last_login                 datetime(6)  null,
    is_superuser               tinyint(1)   not null,
    created_at                 datetime(6)  not null,
    updated_at                 datetime(6)  not null,
    image                      varchar(600) null,
    image_alt                  varchar(200) null,
    user_id                    varchar(15)  not null
        primary key,
    first_name                 varchar(50)  not null,
    last_name                  varchar(50)  not null,
    email                      varchar(254) not null,
    gender                     int          null,
    allergy                    varchar(250) not null,
    tool                       varchar(100) not null,
    is_staff                   tinyint(1)   not null,
    is_active                  tinyint(1)   not null,
    public_event_registrations tinyint(1)   not null,
    slack_user_id              varchar(20)  not null,
    accepts_event_rules        tinyint(1)   not null,
    allows_photo_by_default    tinyint(1)   not null
)
    collate = utf8mb4_unicode_ci;

create table authtoken_token
(
    `key`   varchar(40) not null
        primary key,
    created datetime(6) not null,
    user_id varchar(15) not null,
    constraint user_id
        unique (user_id),
    constraint authtoken_token_user_id_35299eff_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table badge_userbadge
(
    id         int auto_increment
        primary key,
    created_at datetime(6) not null,
    updated_at datetime(6) not null,
    badge_id   char(32)    not null,
    user_id    varchar(15) not null,
    constraint badge_userbadge_user_id_badge_id_2047cdcf_uniq
        unique (user_id, badge_id),
    constraint content_userbadge_badge_id_73558596_fk_content_badge_id
        foreign key (badge_id) references badge_badge (id),
    constraint content_userbadge_user_id_374e210b_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table communication_mail_users
(
    id      int auto_increment
        primary key,
    mail_id char(32)    not null,
    user_id varchar(15) not null,
    constraint communication_mail_users_mail_id_user_id_a0a4fb4e_uniq
        unique (mail_id, user_id),
    constraint communication_mail_u_mail_id_e48717d7_fk_communica
        foreign key (mail_id) references communication_mail (id),
    constraint communication_mail_u_user_id_0b3bff31_fk_content_u
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table communication_notification
(
    id          int auto_increment
        primary key,
    title       varchar(150) not null,
    user_id     varchar(15)  not null,
    `read`      tinyint(1)   not null,
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    description longtext     not null,
    link        varchar(150) null,
    constraint content_notification_user_id_1479780a_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table communication_usernotificationsetting
(
    id                int auto_increment
        primary key,
    created_at        datetime(6) not null,
    updated_at        datetime(6) not null,
    notification_type varchar(30) not null,
    email             tinyint(1)  not null,
    website           tinyint(1)  not null,
    slack             tinyint(1)  not null,
    user_id           varchar(15) not null,
    constraint communication_usernotifi_user_id_notification_typ_04c32f32_uniq
        unique (user_id, notification_type),
    constraint communication_userno_user_id_5b5f433e_fk_content_u
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_news
(
    id             int auto_increment
        primary key,
    created_at     datetime(6)  not null,
    updated_at     datetime(6)  not null,
    image          varchar(600) null,
    image_alt      varchar(200) null,
    title          varchar(200) not null,
    header         varchar(200) not null,
    body           longtext     not null,
    creator_id     varchar(15)  null,
    emojis_allowed tinyint(1)   not null,
    constraint content_news_creator_id_aff0359e_fk_content_user_user_id
        foreign key (creator_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_shortlink
(
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    name       varchar(50)  not null
        primary key,
    url        varchar(600) not null,
    user_id    varchar(15)  not null,
    constraint content_shortlink_user_id_2294a369_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_user_groups
(
    id       int auto_increment
        primary key,
    user_id  varchar(15) not null,
    group_id int         not null,
    constraint content_user_groups_user_id_group_id_fbca6d3f_uniq
        unique (user_id, group_id),
    constraint content_user_groups_group_id_e9f99908_fk_auth_group_id
        foreign key (group_id) references auth_group (id),
    constraint content_user_groups_user_id_29d6ddd3_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_userbio
(
    id            int auto_increment
        primary key,
    description   varchar(500) null,
    gitHub_link   varchar(300) null,
    linkedIn_link varchar(300) null,
    user_id       varchar(15)  not null,
    created_at    datetime(6)  not null,
    updated_at    datetime(6)  not null,
    constraint content_userbio_user_id_53dacd78_uniq
        unique (user_id),
    constraint content_userbio_user_id_53dacd78_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table django_content_type
(
    id        int auto_increment
        primary key,
    app_label varchar(100) not null,
    model     varchar(100) not null,
    constraint django_content_type_app_label_model_76bd3d3b_uniq
        unique (app_label, model)
)
    collate = utf8mb4_unicode_ci;

create table auth_permission
(
    id              int auto_increment
        primary key,
    name            varchar(255) not null,
    content_type_id int          not null,
    codename        varchar(100) not null,
    constraint auth_permission_content_type_id_codename_01ab375a_uniq
        unique (content_type_id, codename),
    constraint auth_permission_content_type_id_2f476e4b_fk_django_co
        foreign key (content_type_id) references django_content_type (id)
)
    collate = utf8mb4_unicode_ci;

create table auth_group_permissions
(
    id            int auto_increment
        primary key,
    group_id      int not null,
    permission_id int not null,
    constraint auth_group_permissions_group_id_permission_id_0cd325b0_uniq
        unique (group_id, permission_id),
    constraint auth_group_permissio_permission_id_84c5c92e_fk_auth_perm
        foreign key (permission_id) references auth_permission (id),
    constraint auth_group_permissions_group_id_b120cbf9_fk_auth_group_id
        foreign key (group_id) references auth_group (id)
)
    collate = utf8mb4_unicode_ci;

create table content_user_user_permissions
(
    id            int auto_increment
        primary key,
    user_id       varchar(15) not null,
    permission_id int         not null,
    constraint content_user_user_permis_user_id_permission_id_33d97c12_uniq
        unique (user_id, permission_id),
    constraint content_user_user_pe_permission_id_f3b02169_fk_auth_perm
        foreign key (permission_id) references auth_permission (id),
    constraint content_user_user_pe_user_id_74da6725_fk_content_u
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table django_admin_log
(
    id              int auto_increment
        primary key,
    action_time     datetime(6)       not null,
    object_id       longtext          null,
    object_repr     varchar(200)      not null,
    action_flag     smallint unsigned not null,
    change_message  longtext          not null,
    content_type_id int               null,
    user_id         varchar(15)       not null,
    constraint django_admin_log_content_type_id_c4bce8eb_fk_django_co
        foreign key (content_type_id) references django_content_type (id),
    constraint django_admin_log_user_id_c564eba6_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table django_migrations
(
    id      int auto_increment
        primary key,
    app     varchar(255) not null,
    name    varchar(255) not null,
    applied datetime(6)  not null
)
    collate = utf8mb4_unicode_ci;

create table django_session
(
    session_key  varchar(40) not null
        primary key,
    session_data longtext    not null,
    expire_date  datetime(6) not null
)
    collate = utf8mb4_unicode_ci;

create index django_session_expire_date_a5c62663
    on django_session (expire_date);

create table emoji_reaction
(
    created_at      datetime(6)  not null,
    updated_at      datetime(6)  not null,
    reaction_id     int auto_increment
        primary key,
    emoji           varchar(60)  not null,
    object_id       int unsigned null,
    content_type_id int          null,
    user_id         varchar(15)  not null,
    constraint emoji_reaction_user_id_object_id_content_type_id_176e01bf_uniq
        unique (user_id, object_id, content_type_id),
    constraint emoji_reaction_content_type_id_41f30873_fk_django_co
        foreign key (content_type_id) references django_content_type (id),
    check (`object_id` >= 0)
)
    collate = utf8mb4_unicode_ci;

create table feedback_feedback
(
    id                   int auto_increment
        primary key,
    created_at           datetime(6)  not null,
    updated_at           datetime(6)  not null,
    title                varchar(100) not null,
    description          longtext     not null,
    status               varchar(20)  not null,
    author_id            varchar(15)  null,
    polymorphic_ctype_id int          null,
    constraint feedback_feedback_author_id_4179fe22_fk_content_user_user_id
        foreign key (author_id) references content_user (user_id),
    constraint feedback_feedback_polymorphic_ctype_id_13348aa2_fk_django_co
        foreign key (polymorphic_ctype_id) references django_content_type (id)
)
    collate = utf8mb4_unicode_ci;

create table feedback_bug
(
    feedback_ptr_id int          not null
        primary key,
    browser         varchar(200) not null,
    platform        varchar(200) not null,
    url             varchar(200) null,
    constraint feedback_bug_feedback_ptr_id_fe5e97ba_fk_feedback_feedback_id
        foreign key (feedback_ptr_id) references feedback_feedback (id)
)
    collate = utf8mb4_unicode_ci;

create table feedback_idea
(
    feedback_ptr_id int not null
        primary key,
    constraint feedback_idea_feedback_ptr_id_e7934be3_fk_feedback_feedback_id
        foreign key (feedback_ptr_id) references feedback_feedback (id)
)
    collate = utf8mb4_unicode_ci;

create table files_usergallery
(
    id         int auto_increment
        primary key,
    created_at datetime(6) not null,
    updated_at datetime(6) not null,
    author_id  varchar(15) not null,
    constraint author_id
        unique (author_id),
    constraint files_usergallery_author_id_b9bf916a_fk_content_user_user_id
        foreign key (author_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table files_file
(
    id          int auto_increment
        primary key,
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    title       varchar(80)  not null,
    description longtext     not null,
    gallery_id  int          not null,
    file        varchar(600) null,
    constraint files_file_gallery_id_8fef6fd5_fk_files_usergallery_id
        foreign key (gallery_id) references files_usergallery (id)
)
    collate = utf8mb4_unicode_ci;

create table forms_form
(
    id                   char(32)     not null
        primary key,
    title                varchar(400) not null,
    polymorphic_ctype_id int          null,
    template             tinyint(1)   not null,
    description          longtext     not null,
    constraint forms_form_polymorphic_ctype_id_317b599b_fk_django_co
        foreign key (polymorphic_ctype_id) references django_content_type (id)
)
    collate = utf8mb4_unicode_ci;

create table forms_field
(
    id       char(32)     not null
        primary key,
    title    varchar(400) not null,
    type     varchar(40)  not null,
    required tinyint(1)   not null,
    form_id  char(32)     not null,
    `order`  int unsigned not null,
    constraint forms_field_form_id_9ca5dc7e_fk_forms_form_id
        foreign key (form_id) references forms_form (id)
)
    collate = utf8mb4_unicode_ci;

create index forms_field_order_3f1d0428
    on forms_field (`order`);

create table forms_option
(
    id       char(32)     not null
        primary key,
    title    varchar(400) not null,
    field_id char(32)     not null,
    `order`  int unsigned not null,
    constraint forms_option_field_id_19286832_fk_forms_field_id
        foreign key (field_id) references forms_field (id)
)
    collate = utf8mb4_unicode_ci;

create index forms_option_order_4d233f19
    on forms_option (`order`);

create table forms_submission
(
    created_at datetime(6) not null,
    updated_at datetime(6) not null,
    id         char(32)    not null
        primary key,
    form_id    char(32)    not null,
    user_id    varchar(15) not null,
    constraint forms_submission_form_id_fe1f7a8a_fk_forms_form_id
        foreign key (form_id) references forms_form (id),
    constraint forms_submission_user_id_10a188d2_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table forms_answer
(
    created_at    datetime(6) not null,
    updated_at    datetime(6) not null,
    id            char(32)    not null
        primary key,
    answer_text   longtext    not null,
    field_id      char(32)    null,
    submission_id char(32)    not null,
    constraint forms_answer_field_id_c5b5d06d_fk_forms_field_id
        foreign key (field_id) references forms_field (id),
    constraint forms_answer_submission_id_033c1ec5_fk_forms_submission_id
        foreign key (submission_id) references forms_submission (id)
)
    collate = utf8mb4_unicode_ci;

create table forms_answer_selected_options
(
    id        int auto_increment
        primary key,
    answer_id char(32) not null,
    option_id char(32) not null,
    constraint forms_answer_selected_options_answer_id_option_id_dac3c1eb_uniq
        unique (answer_id, option_id),
    constraint forms_answer_selecte_answer_id_f47e4368_fk_forms_ans
        foreign key (answer_id) references forms_answer (id),
    constraint forms_answer_selecte_option_id_4b85e230_fk_forms_opt
        foreign key (option_id) references forms_option (id)
)
    collate = utf8mb4_unicode_ci;

create index forms_submission_form_id_fe1f7a8a
    on forms_submission (form_id);

create table group_group
(
    created_at      datetime(6)  not null,
    updated_at      datetime(6)  not null,
    image           varchar(600) null,
    image_alt       varchar(200) null,
    name            varchar(50)  not null,
    slug            varchar(50)  not null
        primary key,
    description     longtext     null,
    contact_email   varchar(200) null,
    type            varchar(50)  not null,
    fine_info       longtext     not null,
    fines_activated tinyint(1)   not null,
    fines_admin_id  varchar(15)  null,
    constraint group_group_fines_admin_id_1c7f4107_fk_content_user_user_id
        foreign key (fines_admin_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table codex_codexevent
(
    id                    int auto_increment
        primary key,
    created_at            datetime(6)   not null,
    updated_at            datetime(6)   not null,
    title                 varchar(255)  not null,
    description           longtext      not null,
    start_date            datetime(6)   not null,
    start_registration_at datetime(6)   null,
    end_registration_at   datetime(6)   null,
    tag                   varchar(50)   not null,
    location              varchar(200)  null,
    mazemap_link          varchar(2000) null,
    lecturer_id           varchar(15)   null,
    organizer_id          varchar(50)   null,
    constraint codex_codexevent_lecturer_id_d89c67a6_fk_content_user_user_id
        foreign key (lecturer_id) references content_user (user_id),
    constraint codex_codexevent_organizer_id_22fe60cf_fk_group_group_slug
        foreign key (organizer_id) references group_group (slug)
)
    collate = utf8mb4_unicode_ci;

create table codex_codexeventregistration
(
    created_at      datetime(6) not null,
    updated_at      datetime(6) not null,
    registration_id int auto_increment
        primary key,
    `order`         int         not null,
    event_id        int         not null,
    user_id         varchar(15) not null,
    constraint codex_codexeventregistration_user_id_event_id_6c058832_uniq
        unique (user_id, event_id),
    constraint codex_codexeventregi_event_id_7be9c802_fk_codex_cod
        foreign key (event_id) references codex_codexevent (id),
    constraint codex_codexeventregi_user_id_9cbb9448_fk_content_u
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_event
(
    id                                int auto_increment
        primary key,
    created_at                        datetime(6)  not null,
    updated_at                        datetime(6)  not null,
    image                             varchar(600) null,
    image_alt                         varchar(200) null,
    title                             varchar(200) not null,
    start_date                        datetime(6)  not null,
    location                          varchar(200) null,
    description                       longtext     not null,
    sign_up                           tinyint(1)   not null,
    `limit`                           int          not null,
    closed                            tinyint(1)   not null,
    category_id                       int          null,
    end_registration_at               datetime(6)  null,
    start_registration_at             datetime(6)  null,
    end_date                          datetime(6)  not null,
    sign_off_deadline                 datetime(6)  null,
    can_cause_strikes                 tinyint(1)   not null,
    enforces_previous_strikes         tinyint(1)   not null,
    only_allow_prioritized            tinyint(1)   not null,
    organizer_id                      varchar(50)  null,
    runned_post_event_actions         tinyint(1)   not null,
    runned_sign_off_deadline_reminder tinyint(1)   not null,
    runned_sign_up_start_notifier     tinyint(1)   not null,
    contact_person_id                 varchar(15)  null,
    emojis_allowed                    tinyint(1)   not null,
    constraint content_event_category_id_e0273558_fk_content_category_id
        foreign key (category_id) references content_category (id),
    constraint content_event_contact_person_id_4fd7294c_fk_content_user_user_id
        foreign key (contact_person_id) references content_user (user_id),
    constraint content_event_organizer_id_617f283e_fk_group_group_slug
        foreign key (organizer_id) references group_group (slug)
)
    collate = utf8mb4_unicode_ci;

create table content_event_favorite_users
(
    id       int auto_increment
        primary key,
    event_id int         not null,
    user_id  varchar(15) not null,
    constraint content_event_favorite_users_event_id_user_id_4dc70999_uniq
        unique (event_id, user_id),
    constraint content_event_favori_event_id_86091c8b_fk_content_e
        foreign key (event_id) references content_event (id),
    constraint content_event_favori_user_id_b40a8137_fk_content_u
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_minute
(
    id         int auto_increment
        primary key,
    created_at datetime(6)  not null,
    updated_at datetime(6)  not null,
    title      varchar(200) not null,
    content    longtext     not null,
    author_id  varchar(15)  null,
    tag        varchar(50)  not null,
    group_id   varchar(50)  null,
    constraint content_minute_author_id_c15f6026_fk_content_user_user_id
        foreign key (author_id) references content_user (user_id),
    constraint content_minute_group_id_e95f164e_fk_group_group_slug
        foreign key (group_id) references group_group (slug)
)
    collate = utf8mb4_unicode_ci;

create table content_prioritypool
(
    id         int auto_increment
        primary key,
    created_at datetime(6) not null,
    updated_at datetime(6) not null,
    event_id   int         not null,
    constraint content_prioritypool_event_id_feb61f40_fk_content_event_id
        foreign key (event_id) references content_event (id)
)
    collate = utf8mb4_unicode_ci;

create table content_prioritypool_groups
(
    id              int auto_increment
        primary key,
    prioritypool_id int         not null,
    group_id        varchar(50) not null,
    constraint content_prioritypool_gro_prioritypool_id_group_id_4cd2dc8e_uniq
        unique (prioritypool_id, group_id),
    constraint content_prioritypool_group_id_66683187_fk_group_gro
        foreign key (group_id) references group_group (slug),
    constraint content_prioritypool_prioritypool_id_493ebbdd_fk_content_p
        foreign key (prioritypool_id) references content_prioritypool (id)
)
    collate = utf8mb4_unicode_ci;

create table content_registration
(
    created_at         datetime(6) not null,
    updated_at         datetime(6) not null,
    registration_id    int auto_increment
        primary key,
    is_on_wait         tinyint(1)  not null,
    has_attended       tinyint(1)  not null,
    event_id           int         not null,
    user_id            varchar(15) not null,
    allow_photo        tinyint(1)  not null,
    created_by_admin   tinyint(1)  not null,
    payment_expiredate datetime(6) null,
    constraint content_userevent_user_id_event_id_87efc7d2_uniq
        unique (user_id, event_id),
    constraint content_registration_event_id_ecfc61dd_fk_content_event_id
        foreign key (event_id) references content_event (id),
    constraint content_registration_user_id_221f5c61_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table content_strike
(
    id          char(32)     not null
        primary key,
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    description varchar(200) not null,
    strike_size int          not null,
    creator_id  varchar(15)  null,
    event_id    int          null,
    user_id     varchar(15)  not null,
    constraint content_strike_creator_id_703ccc8b_fk_content_user_user_id
        foreign key (creator_id) references content_user (user_id),
    constraint content_strike_event_id_8fe138fc_fk_content_event_id
        foreign key (event_id) references content_event (id),
    constraint content_strike_user_id_50010c86_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table forms_eventform
(
    form_ptr_id char(32)    not null
        primary key,
    type        varchar(40) not null,
    event_id    int         not null,
    constraint forms_eventform_event_id_type_bd78b3c5_uniq
        unique (event_id, type),
    constraint forms_eventform_event_id_1d10fff5_fk_content_event_id
        foreign key (event_id) references content_event (id),
    constraint forms_eventform_form_ptr_id_55fdef68_fk_forms_form_id
        foreign key (form_ptr_id) references forms_form (id)
)
    collate = utf8mb4_unicode_ci;

create table forms_groupform
(
    form_ptr_id              char(32)     not null
        primary key,
    group_id                 varchar(50)  not null,
    can_submit_multiple      tinyint(1)   not null,
    is_open_for_submissions  tinyint(1)   not null,
    only_for_group_members   tinyint(1)   not null,
    email_receiver_on_submit varchar(200) null,
    constraint forms_groupform_form_ptr_id_1e35c0db_fk_forms_form_id
        foreign key (form_ptr_id) references forms_form (id),
    constraint forms_groupform_group_id_59b12832_fk_group_group_slug
        foreign key (group_id) references group_group (slug)
)
    collate = utf8mb4_unicode_ci;

create table gallery_album
(
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    image       varchar(600) null,
    image_alt   varchar(200) null,
    title       varchar(100) not null,
    description longtext     not null,
    slug        varchar(50)  not null,
    event_id    int          null,
    id          char(32)     not null
        primary key,
    constraint gallery_album_event_id_0400ecb5_fk_content_event_id
        foreign key (event_id) references content_event (id)
)
    collate = utf8mb4_unicode_ci;

create index gallery_album_slug_5105c2f0
    on gallery_album (slug);

create table gallery_picture
(
    created_at  datetime(6)  not null,
    updated_at  datetime(6)  not null,
    id          char(32)     not null
        primary key,
    image       varchar(400) not null,
    title       varchar(100) not null,
    image_alt   varchar(100) not null,
    description longtext     not null,
    album_id    char(32)     null,
    constraint gallery_picture_album_id_b16ecbbf_fk_gallery_album_id
        foreign key (album_id) references gallery_album (id)
)
    collate = utf8mb4_unicode_ci;

create table group_fine
(
    id            char(32)     not null
        primary key,
    created_at    datetime(6)  not null,
    updated_at    datetime(6)  not null,
    amount        int          not null,
    approved      tinyint(1)   not null,
    payed         tinyint(1)   not null,
    description   varchar(100) not null,
    reason        longtext     not null,
    created_by_id varchar(15)  not null,
    group_id      varchar(50)  not null,
    user_id       varchar(15)  not null,
    image         varchar(600) null,
    image_alt     varchar(200) null,
    defense       longtext     not null,
    constraint group_fine_created_by_id_44c665bb_fk_content_user_user_id
        foreign key (created_by_id) references content_user (user_id),
    constraint group_fine_group_id_50ee2d86_fk_group_group_slug
        foreign key (group_id) references group_group (slug),
    constraint group_fine_user_id_b76ece05_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table group_law
(
    id          char(32)      not null
        primary key,
    created_at  datetime(6)   not null,
    updated_at  datetime(6)   not null,
    description longtext      not null,
    title       varchar(100)  not null,
    amount      int           not null,
    group_id    varchar(50)   not null,
    paragraph   decimal(4, 2) not null,
    constraint group_law_group_id_e0500d27_fk_group_group_slug
        foreign key (group_id) references group_group (slug)
)
    collate = utf8mb4_unicode_ci;

create table group_membership
(
    id              int auto_increment
        primary key,
    created_at      datetime(6) not null,
    updated_at      datetime(6) not null,
    membership_type varchar(50) not null,
    expiration_date date        null,
    group_id        varchar(50) not null,
    user_id         varchar(15) not null,
    constraint group_membership_user_id_group_id_f6221897_uniq
        unique (user_id, group_id),
    constraint group_membership_group_id_45c6964f_fk_group_group_slug
        foreign key (group_id) references group_group (slug),
    constraint group_membership_user_id_35a27eaa_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table group_membershiphistory
(
    id              int auto_increment
        primary key,
    created_at      datetime(6) not null,
    updated_at      datetime(6) not null,
    membership_type varchar(50) not null,
    start_date      datetime(6) not null,
    end_date        datetime(6) not null,
    group_id        varchar(50) not null,
    user_id         varchar(15) not null,
    constraint group_membershiphistory_user_id_group_id_end_date_b2e8fa87_uniq
        unique (user_id, group_id, end_date),
    constraint group_membershiphistory_group_id_c5cd6678_fk_group_group_slug
        foreign key (group_id) references group_group (slug),
    constraint group_membershiphistory_user_id_f15d6f38_fk_content_user_user_id
        foreign key (user_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table kontres_bookableitem
(
    created_at     datetime(6)  not null,
    updated_at     datetime(6)  not null,
    id             char(32)     not null
        primary key,
    name           varchar(20)  not null,
    description    longtext     not null,
    allows_alcohol tinyint(1)   not null,
    image          varchar(600) null,
    image_alt      varchar(200) null
)
    collate = utf8mb4_unicode_ci;

create table kontres_reservation
(
    created_at       datetime(6)                   not null,
    updated_at       datetime(6)                   not null,
    id               char(32)                      not null
        primary key,
    start_time       datetime(6)                   not null,
    end_time         datetime(6)                   not null,
    state            varchar(15)                   not null,
    author_id        varchar(15)                   null,
    bookable_item_id char(32)                      null,
    accepted_rules   tinyint(1)                    not null,
    description      longtext default (_utf8mb4'') not null,
    group_id         varchar(50)                   null,
    serves_alcohol   tinyint(1)                    not null,
    sober_watch_id   varchar(15)                   null,
    approved_by_id   varchar(15)                   null,
    constraint kontres_reservation_approved_by_id_ab8ef6b7_fk_content_u
        foreign key (approved_by_id) references content_user (user_id),
    constraint kontres_reservation_author_id_4905c696_fk_content_user_user_id
        foreign key (author_id) references content_user (user_id),
    constraint kontres_reservation_bookable_item_id_05f2b955_fk_kontres_b
        foreign key (bookable_item_id) references kontres_bookableitem (id),
    constraint kontres_reservation_group_id_ad99d07a_fk_group_group_slug
        foreign key (group_id) references group_group (slug),
    constraint kontres_reservation_sober_watch_id_f643f26e_fk_content_u
        foreign key (sober_watch_id) references content_user (user_id)
)
    collate = utf8mb4_unicode_ci;

create table payment_order
(
    order_id     char(32)      not null
        primary key,
    created_at   datetime(6)   not null,
    updated_at   datetime(6)   not null,
    status       varchar(16)   not null,
    payment_link varchar(2000) not null,
    event_id     int           null,
    user_id      varchar(15)   null,
    constraint payment_order_event_id_dab25082_fk_content_event_id
        foreign key (event_id) references content_event (id)
)
    collate = utf8mb4_unicode_ci;

create table payment_paidevent
(
    created_at datetime(6)   not null,
    updated_at datetime(6)   not null,
    event_id   int           not null
        primary key,
    price      decimal(6, 2) not null,
    paytime    time(6)       not null,
    constraint payment_paidevent_event_id_4b540b22_fk_content_event_id
        foreign key (event_id) references content_event (id)
)
    collate = utf8mb4_unicode_ci;
