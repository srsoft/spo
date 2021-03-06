import { createNamespacedHelpers } from 'vuex';

import ChattingContainer from '~/components/sidebar/chattings/ChattingContainer';
import ChatItem from '~/components/sidebar/chattings/ChatItem';
import ChatEnteredItem from '~/components/sidebar/chattings/ChatEnteredItem';
import ChatBettingItem from '~/components/sidebar/chattings/ChatBettingItem';

const {
  mapState: chattingState,
  mapGetters: chattingGetters,
} = createNamespacedHelpers('chatting');

const { mapGetters: chatFilterGetters } = createNamespacedHelpers(
  'chatting/filter'
);

const {
  mapState: idNickState,
  mapActions: idNickActions,
} = createNamespacedHelpers('user/idnick');

const COOKIE_KEY_NOTIFY_ENTER_USER = 'ls_notify_enter_user';
const COOKIE_KEY_SCROLL_LOCK = 'ls_scroll_lock';

export default {
  components: {
    ChattingContainer,
    ChatItem,
    ChatEnteredItem,
    ChatBettingItem,
  },
  data() {
    return {
      chat: {
        notifyEnterUser: false,
        scrollLock: false,
      },
      selectedChatIndex: null,
      oldChatItemCount: 0,
    };
  },
  computed: {
    ...idNickState({
      nickname: 'nickname',
    }),
    ...chattingState({
      connected: 'connected',
      chatItems: 'items',
      joinReady: 'joinReady',
    }),
    ...chattingGetters(['chatItemCount']),
    ...chatFilterGetters({
      isMessageVaild: 'isValid',
    }),
  },
  watch: {
    chatItems(v, o) {
      if (!this.chat.scrollLock) {
        this.scrollDown();
      }
      console.log('chatItems', v.length);
      if (this.oldChatItemCount < v.length) {
        this.oldChatItemCount = v.length;
        console.log('oldChatItemCount', this.oldChatItemCount);
        return;
      }
      console.log('oldChatItemCount', this.oldChatItemCount);
      if (this.selectedChatIndex - 1 < 0) {
        this.selectedChatIndex = null;
      } else {
        this.selectedChatIndex = this.selectedChatIndex - 1;
      }
      console.log('selectedChatIndex', this.selectedChatIndex);
    },
    async joinReady(v) {
      if (v.part === 'InviteOneOnOneRoomUid') {
        this.showSingleButtonModal({
          message:
            v.mb_nick +
            '?????? 1:1 ????????? ??????????????????.<br />???????????? ?????? ??? ???????????? ???????????? ????????????.',
          description: null,
          accent: '????????????',
          timer: true,
          onConfirm: () => {
            console.log('...');
          },
        });
      } else if (v.part === 'acceptOneOnOneRoom') {
        console.log('openChatPopup::', this.$auth.user.mb_id, v.to_id);
        let toid = '';
        if (this.$auth.user.mb_id !== v.to_id) {
          toid = v.to_id;
        }
        // ?????? ?????? ??????
        if (this.userChatRooms !== v.inviteid) {
          await this.getNickname({ id: toid });
          this.openChatPopup(v.inviteid, this.nickname ? this.nickname : toid);
          this.$jquery('.btn-confirm').trigger('click');
        }
        this.userChatRooms = v.inviteid;
      } else if (v.part === 'InviteOneOnOneRoom') {
        await this.getNickname({ id: v.createMbId });
        this.showDoubleButtonsModal({
          message: `${
            this.nickname ? this.nickname : v.createMbId
          }??????????????? 1:1????????? ?????????????????????.<br />?????????????????????????`,
          description: null,
          accent: '????????????',
          timer: true,
          buttonConfirmText: '??????',
          buttonCancelText: '??????',
          onConfirm: () => {
            console.log('?????? ??????');
            const { inviteid } = v;
            this._receiveOneOnOne({ inviteid });
          },
          onCancel: () => {
            // ?????? ?????? ??????
            this._rejectOneOnOne(v);
          },
        });
      } else if (v.part === 'rejectOneOnOneRoom') {
        if (v.to_id !== this.$auth.user.mb_id) {
          // ???????????? ??? ???????????? ????????? ??????
          if (v.msg === '?????? ???????????????.') {
            this.$jquery('.btn-confirm').trigger('click');
          }
          this.showSingleButtonModal({
            message: v.msg,
            description: null,
            accent: null,
          });
        }
      } else {
        this.$jquery('.btn-confirm').trigger('click');
      }
    },
  },
  mounted() {
    this._joinRoom();
  },
  beforeMount() {
    this.chat.notifyEnterUser =
      this.$cookies.get(COOKIE_KEY_NOTIFY_ENTER_USER) || false;
    this.chat.scrollLock = this.$cookies.get(COOKIE_KEY_SCROLL_LOCK) || false;
    this._setNotifyEnterUser({ notifyEnterUser: this.chat.notifyEnterUser });
  },
  methods: {
    ...idNickActions({
      getNickname: 'getNickname',
    }),
    onBettingDetailClick(v) {
      this.showBettingShareModal(v);
    },
    onShareClick() {
      if (!this.$auth.loggedIn) {
        this.showPleaseLogInModal();
        return;
      }
      this.showSelectHistoriesModal({
        isShareMode: true,
        onSelected: (v, close) => {
          this._shareBettingHistory(v);
        },
      });
    },
    onMessageClick(v) {
      this.selectedChatIndex = null;
      if (v.isAdmin) {
        this.showSingleButtonModal({
          message: '?????????????????? ????????? ???????????? ??? ????????????.',
        });
        return;
      }
      this.openMessagesPopup(v.nickname);
    },
    onNicknameClick(v) {
      if (v.selected) {
        this.selectedChatIndex = null;
      } else {
        this.selectedChatIndex = v.index;
      }
    },
    onAllowChatChange(v) {
      this.updateDeny({ chat: v, memo: this.$auth.mb_deny_memo === '1' });
    },
    onAllowMessageChange(v) {
      this.updateDeny({ chat: this.$auth.user.mb_deny_chat === '1', memo: v });
    },
    onChattingClick(v) {
      this.selectedChatIndex = null;
      if (v.isAdmin) {
        this.showSingleButtonModal({
          message: '?????????????????? 1:1????????? ?????? ??? ????????????.',
        });
        return;
      }
      this.showDoubleButtonsModal({
        message: `${v.nickname} ?????? 1:1 ????????? ?????????????????????????`,
        buttonConfirmText: '??????',
        onConfirm: () => {
          const { id, nickname } = v;
          this._requestOneOnOne({ id, nickname });
        },
      });
    },
    sendChattingMessage({ message, callback }) {
      if (this.isMessageVaild(message)) {
        this.showSingleButtonModal({
          message: '???????????? ?????? ??? ??? ????????????.',
        });
        return;
      }
      this._sendChattingMessage({ message, callback });
    },
    onNotifyChange(v) {
      this.$cookies.set(COOKIE_KEY_NOTIFY_ENTER_USER, v, {
        maxAge: 60 * 60 * 24,
      });
      this._setNotifyEnterUser({ notifyEnterUser: v });
    },
    onScrollLockChange(v) {
      this.$cookies.set(COOKIE_KEY_SCROLL_LOCK, v, {
        maxAge: 60 * 60 * 24,
      });
      this.chat.scrollLock = v;
    },
    scrollDown() {
      const chatList = this.$jquery(
        'div.chat-container div.chat-content div.chat-list'
      );
      chatList.animate(
        {
          scrollTop:
            chatList[0].scrollHeight === chatList[0].clientHeight
              ? 9999
              : chatList[0].scrollHeight,
        },
        100
      );
    },
  },
};
