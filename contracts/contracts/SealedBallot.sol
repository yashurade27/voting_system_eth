// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SealedBallot
/// @notice Multi-election voting contract that uses a commit–reveal scheme so that
///         nobody (not even the organiser) can see how anyone voted until the
///         voting window has closed.
///
///         Lifecycle of every election:
///           Setup  -> organiser adds candidates (at creation) and registers voters
///           Commit -> voters submit keccak256(electionId, candidateId, salt, voter)
///           Reveal -> voters disclose (candidateId, salt); valid reveals are counted
///           Ended  -> tallies are frozen and the winner(s) can be read on-chain
contract SealedBallot {
    enum Phase {
        Setup,
        Commit,
        Reveal,
        Ended
    }

    struct Candidate {
        string name;
        uint256 votes;
    }

    struct Election {
        string title;
        string description;
        address organiser;
        bool openToAll;
        Phase phase;
        uint64 createdAt;
        uint64 phaseChangedAt;
        uint32 voterCount;
        uint32 commitCount;
        uint32 revealCount;
        Candidate[] candidates;
    }

    struct ElectionView {
        uint256 id;
        string title;
        string description;
        address organiser;
        bool openToAll;
        Phase phase;
        uint64 createdAt;
        uint64 phaseChangedAt;
        uint32 voterCount;
        uint32 commitCount;
        uint32 revealCount;
        uint256 candidateCount;
    }

    struct VoterStatus {
        bool eligible;
        bool committed;
        bool revealed;
        bytes32 commitment;
    }

    uint256 public constant MAX_CANDIDATES = 16;
    uint256 public constant MAX_BATCH = 100;

    Election[] private _elections;
    mapping(uint256 => mapping(address => bool)) private _registered;
    mapping(uint256 => mapping(address => bytes32)) private _commitments;
    mapping(uint256 => mapping(address => bool)) private _revealed;

    event ElectionCreated(uint256 indexed id, address indexed organiser, string title, bool openToAll);
    event VoterRegistered(uint256 indexed id, address indexed voter);
    event PhaseChanged(uint256 indexed id, Phase phase);
    event VoteCommitted(uint256 indexed id, address indexed voter, bytes32 commitment);
    event VoteRevealed(uint256 indexed id, address indexed voter, uint256 candidateId);

    error ElectionNotFound();
    error NotOrganiser();
    error WrongPhase(Phase expected, Phase actual);
    error InvalidCandidates();
    error BatchTooLarge();
    error NotEligible();
    error NothingCommitted();
    error AlreadyRevealed();
    error CommitmentMismatch();
    error InvalidCandidate();
    error EmptyCommitment();

    modifier exists(uint256 id) {
        if (id >= _elections.length) revert ElectionNotFound();
        _;
    }

    modifier onlyOrganiser(uint256 id) {
        if (_elections[id].organiser != msg.sender) revert NotOrganiser();
        _;
    }

    modifier inPhase(uint256 id, Phase expected) {
        Phase actual = _elections[id].phase;
        if (actual != expected) revert WrongPhase(expected, actual);
        _;
    }

    // ------------------------------------------------------------------
    // Organiser actions
    // ------------------------------------------------------------------

    function createElection(
        string calldata title,
        string calldata description,
        string[] calldata candidateNames,
        bool openToAll
    ) external returns (uint256 id) {
        if (candidateNames.length < 2 || candidateNames.length > MAX_CANDIDATES) revert InvalidCandidates();
        if (bytes(title).length == 0) revert InvalidCandidates();

        id = _elections.length;
        Election storage e = _elections.push();
        e.title = title;
        e.description = description;
        e.organiser = msg.sender;
        e.openToAll = openToAll;
        e.phase = Phase.Setup;
        e.createdAt = uint64(block.timestamp);
        e.phaseChangedAt = uint64(block.timestamp);

        for (uint256 i = 0; i < candidateNames.length; i++) {
            if (bytes(candidateNames[i]).length == 0) revert InvalidCandidates();
            e.candidates.push(Candidate({name: candidateNames[i], votes: 0}));
        }

        emit ElectionCreated(id, msg.sender, title, openToAll);
        emit PhaseChanged(id, Phase.Setup);
    }

    function registerVoters(uint256 id, address[] calldata voters)
        external
        exists(id)
        onlyOrganiser(id)
        inPhase(id, Phase.Setup)
    {
        if (voters.length > MAX_BATCH) revert BatchTooLarge();
        Election storage e = _elections[id];
        for (uint256 i = 0; i < voters.length; i++) {
            address v = voters[i];
            if (v == address(0) || _registered[id][v]) continue;
            _registered[id][v] = true;
            e.voterCount++;
            emit VoterRegistered(id, v);
        }
    }

    function openVoting(uint256 id) external exists(id) onlyOrganiser(id) inPhase(id, Phase.Setup) {
        _setPhase(id, Phase.Commit);
    }

    function startReveal(uint256 id) external exists(id) onlyOrganiser(id) inPhase(id, Phase.Commit) {
        _setPhase(id, Phase.Reveal);
    }

    function closeElection(uint256 id) external exists(id) onlyOrganiser(id) inPhase(id, Phase.Reveal) {
        _setPhase(id, Phase.Ended);
    }

    // ------------------------------------------------------------------
    // Voter actions
    // ------------------------------------------------------------------

    /// @notice Submit (or replace) a sealed vote. Replacing is allowed until reveal starts.
    function commitVote(uint256 id, bytes32 commitment) external exists(id) inPhase(id, Phase.Commit) {
        if (commitment == bytes32(0)) revert EmptyCommitment();
        if (!isEligible(id, msg.sender)) revert NotEligible();

        if (_commitments[id][msg.sender] == bytes32(0)) {
            _elections[id].commitCount++;
        }
        _commitments[id][msg.sender] = commitment;
        emit VoteCommitted(id, msg.sender, commitment);
    }

    function revealVote(uint256 id, uint256 candidateId, bytes32 salt) external exists(id) inPhase(id, Phase.Reveal) {
        bytes32 stored = _commitments[id][msg.sender];
        if (stored == bytes32(0)) revert NothingCommitted();
        if (_revealed[id][msg.sender]) revert AlreadyRevealed();

        Election storage e = _elections[id];
        if (candidateId >= e.candidates.length) revert InvalidCandidate();
        if (computeCommitment(id, candidateId, salt, msg.sender) != stored) revert CommitmentMismatch();

        _revealed[id][msg.sender] = true;
        e.revealCount++;
        e.candidates[candidateId].votes++;
        emit VoteRevealed(id, msg.sender, candidateId);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice The hash a voter must commit. Binding the election id and voter address
    ///         prevents replaying or copying someone else's sealed vote.
    function computeCommitment(uint256 id, uint256 candidateId, bytes32 salt, address voter)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(id, candidateId, salt, voter));
    }

    function electionCount() external view returns (uint256) {
        return _elections.length;
    }

    function isEligible(uint256 id, address voter) public view exists(id) returns (bool) {
        return _elections[id].openToAll || _registered[id][voter];
    }

    function getElection(uint256 id) public view exists(id) returns (ElectionView memory) {
        Election storage e = _elections[id];
        return ElectionView({
            id: id,
            title: e.title,
            description: e.description,
            organiser: e.organiser,
            openToAll: e.openToAll,
            phase: e.phase,
            createdAt: e.createdAt,
            phaseChangedAt: e.phaseChangedAt,
            voterCount: e.voterCount,
            commitCount: e.commitCount,
            revealCount: e.revealCount,
            candidateCount: e.candidates.length
        });
    }

    function getElections(uint256 offset, uint256 limit) external view returns (ElectionView[] memory page) {
        uint256 total = _elections.length;
        if (offset >= total) return new ElectionView[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new ElectionView[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = getElection(i);
        }
    }

    /// @notice Tallies are only meaningful once the reveal phase has started; during
    ///         Setup/Commit every count is zero by construction.
    function getCandidates(uint256 id) external view exists(id) returns (Candidate[] memory) {
        return _elections[id].candidates;
    }

    function getVoterStatus(uint256 id, address voter) external view exists(id) returns (VoterStatus memory) {
        bytes32 c = _commitments[id][voter];
        return VoterStatus({
            eligible: isEligible(id, voter),
            committed: c != bytes32(0),
            revealed: _revealed[id][voter],
            commitment: c
        });
    }

    /// @return winnerIds every candidate tied for the highest count (empty if no votes)
    function getWinners(uint256 id) external view exists(id) returns (uint256[] memory winnerIds) {
        Candidate[] storage cs = _elections[id].candidates;
        uint256 best;
        uint256 n;
        for (uint256 i = 0; i < cs.length; i++) {
            if (cs[i].votes > best) {
                best = cs[i].votes;
                n = 1;
            } else if (cs[i].votes == best && best > 0) {
                n++;
            }
        }
        winnerIds = new uint256[](n);
        if (best == 0) return winnerIds;
        uint256 k;
        for (uint256 i = 0; i < cs.length; i++) {
            if (cs[i].votes == best) winnerIds[k++] = i;
        }
    }

    function _setPhase(uint256 id, Phase next) private {
        _elections[id].phase = next;
        _elections[id].phaseChangedAt = uint64(block.timestamp);
        emit PhaseChanged(id, next);
    }
}
